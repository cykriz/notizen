#!/usr/bin/env bash
set -euo pipefail

# Keep the Mac awake for the whole deploy: laptop standby drops the SSH connection
# that drives the remote build and aborts it mid-export. Re-exec once under
# caffeinate (prevents idle sleep) on macOS; the guard var avoids a re-exec loop.
# Note: this can't stop lid-close sleep — keep the lid open during the deploy.
if [ -z "${DEPLOY_CAFFEINATED:-}" ] && [ "$(uname)" = "Darwin" ] && command -v caffeinate >/dev/null 2>&1; then
  export DEPLOY_CAFFEINATED=1
  exec caffeinate -i "$0" "$@"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/deploy.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found. Copy scripts/deploy.env.example and fill in your values." >&2
  exit 1
fi

# Security: parse deploy.env with a key whitelist instead of sourcing it, so a
# compromised env file can't execute arbitrary shell. Reject values with shell
# metacharacters; strip CR + surrounding quotes so the parser stays correct.
UNSAFE_CHARS='[;`$(){}|&]'
while IFS='=' read -r key value || [[ -n "$key" ]]; do
  [[ "$key" =~ ^(NAS|NAS_PORT|IMAGE|REMOTE_DIR|CONTAINER)$ ]] || continue
  value="${value%$'\r'}"
  value="${value%\"}"; value="${value#\"}"
  [[ "$value" =~ $UNSAFE_CHARS ]] && { echo "Error: unsafe value for $key" >&2; exit 1; }
  printf -v "$key" '%s' "$value"
done < "$ENV_FILE"

# Security: escape values that are interpolated into remote shell command strings.
R_REMOTE_DIR=$(printf '%q' "$REMOTE_DIR")
R_CONTAINER=$(printf '%q' "$CONTAINER")

SSH_SOCK="/tmp/deploy-notizen-ssh-$$"
# Capture the real ssh before we prepend the wrapper dir to PATH (avoids recursion).
REAL_SSH="$(command -v ssh)"
SSH_WRAPDIR=""   # set before trap so cleanup stays set -u safe
# Security: array avoids word-splitting; accept-new rejects changed host keys (MITM).
SSH_OPTS=(-o "ControlPath=$SSH_SOCK" -o StrictHostKeyChecking=accept-new)

cleanup() {
  rm -rf "$SSH_WRAPDIR" 2>/dev/null || true
  ssh -O exit -o ControlPath="$SSH_SOCK" "$NAS" 2>/dev/null || true
}
trap cleanup EXIT

# Preflight: the deploy needs the buildx plugin (local). Check before prompting
# for the SSH password so a missing plugin fails fast with a clear message.
if ! docker buildx version >/dev/null 2>&1; then
  echo "Fehler: 'docker buildx' nicht verfügbar — Plugin installieren." >&2
  exit 1
fi

echo "==> SSH-Verbindung herstellen (einmalige Passwort-Eingabe)..."
# Keepalive so the master survives a longer remote build (single password prompt).
ssh -fNM -p "$NAS_PORT" -o ControlMaster=yes \
  -o ServerAliveInterval=30 -o ServerAliveCountMax=6 "${SSH_OPTS[@]}" "$NAS"

echo "==> SSH-Wrapper für Remote-Daemon vorbereiten..."
# docker build over DOCKER_HOST=ssh:// runs `docker system dial-stdio` on the NAS
# through a non-interactive shell that lacks the Synology docker PATH. This ssh
# wrapper (first on PATH, used only for the build) reuses the master socket AND
# injects that PATH into the remote command, so no server-side change is needed.
# The connhelper invokes ssh as: ssh <opts> -- <host> "docker system dial-stdio",
# i.e. the remote command is the single final argument — prefix it with the PATH.
export DEPLOY_REAL_SSH="$REAL_SSH" DEPLOY_SSH_SOCK="$SSH_SOCK"
SSH_WRAPDIR="$(mktemp -d)"
cat > "$SSH_WRAPDIR/ssh" <<'EOF'
#!/usr/bin/env bash
opts=(-o "ControlPath=$DEPLOY_SSH_SOCK" -o ControlMaster=no -o StrictHostKeyChecking=accept-new)
last="${@: -1}"
case "$last" in
  "docker "*)
    n=$(( $# - 1 ))
    exec "$DEPLOY_REAL_SSH" "${opts[@]}" "${@:1:n}" \
      "export PATH=/usr/local/bin:/usr/syno/bin:\$PATH; exec $last"
    ;;
esac
exec "$DEPLOY_REAL_SSH" "${opts[@]}" "$@"
EOF
chmod +x "$SSH_WRAPDIR/ssh"

echo "==> Vorab-Check: Docker-Daemon auf NAS erreichbar..."
if ! PATH="$SSH_WRAPDIR:$PATH" DOCKER_HOST="ssh://$NAS:$NAS_PORT" docker version >/dev/null 2>&1; then
  echo "Fehler: Docker-Daemon auf NAS nicht erreichbar (PATH/Version prüfen)." >&2
  exit 1
fi

# BuildKit on the NAS without enabling it in the Synology daemon: a persistent
# buildx builder backed by a moby/buildkit container on the NAS (bound to the ssh
# endpoint). Gives parallel builds, live progress and a persistent layer cache, so
# re-deploys are fast. Created once via `create` (idempotent: || true if it already
# exists); the build below bootstraps/reuses it and its cache.
BUILDER="notizen-builder"
# BuildKit garbage collection: let the builder self-bound its cache in the
# background instead of a blocking prune in the deploy path. Keeps deploys fast
# AND the cache capped. buildkitd tolerates unknown keys (ignores them), so this
# degrades gracefully on older buildkit. reservedSpace = always keep; maxUsedSpace
# = GC prunes above this.
cat > "$SSH_WRAPDIR/buildkitd.toml" <<'EOF'
[worker.oci]
  gc = true
  reservedSpace = "2GB"
  maxUsedSpace = "5GB"
EOF

# One-time migration of an existing builder to the GC config (it was created
# without it): RECREATE_BUILDER=1 ./scripts/deploy.sh  (drops the cache once).
if [ "${RECREATE_BUILDER:-0}" = "1" ]; then
  echo "==> BuildKit-Builder neu anlegen (RECREATE_BUILDER=1, Cache wird einmalig verworfen)..."
  PATH="$SSH_WRAPDIR:$PATH" DOCKER_HOST="ssh://$NAS:$NAS_PORT" \
    docker buildx rm "$BUILDER" >/dev/null 2>&1 || true
fi

echo "==> BuildKit-Builder auf NAS sicherstellen..."
PATH="$SSH_WRAPDIR:$PATH" DOCKER_HOST="ssh://$NAS:$NAS_PORT" \
  docker buildx create --name "$BUILDER" --driver docker-container \
    --buildkitd-config "$SSH_WRAPDIR/buildkitd.toml" \
    "ssh://$NAS:$NAS_PORT" >/dev/null 2>&1 || true

echo "==> Image nativ auf NAS bauen (BuildKit, kein Cross-Compile)..."
# Pin the SW cache version to the git commit: same commit = same pages-/static-
# <id>, so a redeploy of the same commit doesn't needlessly re-warm caches, and
# distinct commits rotate. Empty (no git) is fine — next.config.ts falls back to
# a random id. Short SHA is hex-only, safe to interpolate.
SW_BUILD_ID="$(git -C "$SCRIPT_DIR/.." rev-parse --short HEAD 2>/dev/null || true)"
# --output type=docker (= --load) but uncompressed: the image is loaded locally
# into the NAS daemon (same host), so gzip-ing the layers is wasted CPU — it gets
# decompressed again immediately. Uncompressed skips the slow single-core gzip
# step that dominated "exporting layers" on the weak NAS CPU.
PATH="$SSH_WRAPDIR:$PATH" DOCKER_HOST="ssh://$NAS:$NAS_PORT" \
  docker buildx build --builder "$BUILDER" \
    --output type=docker,compression=uncompressed \
    --build-arg SW_BUILD_ID="$SW_BUILD_ID" -t "$IMAGE" .

echo "==> Auf NAS: Container neu starten..."
ssh "${SSH_OPTS[@]}" "$NAS" "mkdir -p $R_REMOTE_DIR/data"
scp -O "${SSH_OPTS[@]}" docker-compose.yml "$NAS:$R_REMOTE_DIR/docker-compose.yml"
ssh "${SSH_OPTS[@]}" "$NAS" "
  export PATH=/usr/local/bin:/usr/syno/bin:\$PATH && \
  docker rm -f $R_CONTAINER 2>/dev/null || true && \
  cd $R_REMOTE_DIR && \
  docker compose up -d --force-recreate && \
  docker image prune -f
"

# Manual cache prune (fallback). Normally BuildKit's own GC (configured at builder
# creation above) keeps the cache capped in the background, so this stays OFF — a
# blocking prune on the slow NAS snapshotter would lengthen every deploy. Force a
# full trim on demand with: PRUNE_CACHE=1 ./scripts/deploy.sh
if [ "${PRUNE_CACHE:-0}" = "1" ]; then
  echo "==> BuildKit-Cache auf NAS deckeln (max. 5 GB)..."
  PATH="$SSH_WRAPDIR:$PATH" DOCKER_HOST="ssh://$NAS:$NAS_PORT" \
    docker buildx prune --builder "$BUILDER" -f --max-used-space 5GB >/dev/null 2>&1 || true
fi

echo "==> Fertig. App erreichbar unter http://$NAS:3000"
