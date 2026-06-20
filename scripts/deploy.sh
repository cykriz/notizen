#!/usr/bin/env bash
set -euo pipefail

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
  [[ "$key" =~ ^(NAS|NAS_PORT|IMAGE|ARCHIVE|REMOTE_DIR|CONTAINER)$ ]] || continue
  value="${value%$'\r'}"
  value="${value%\"}"; value="${value#\"}"
  [[ "$value" =~ $UNSAFE_CHARS ]] && { echo "Error: unsafe value for $key" >&2; exit 1; }
  printf -v "$key" '%s' "$value"
done < "$ENV_FILE"

# Security: escape values that are interpolated into remote shell command strings.
R_REMOTE_DIR=$(printf '%q' "$REMOTE_DIR")
R_ARCHIVE=$(printf '%q' "$ARCHIVE")
R_CONTAINER=$(printf '%q' "$CONTAINER")

SSH_SOCK="/tmp/deploy-notizen-ssh-$$"
# Security: array avoids word-splitting; accept-new rejects changed host keys (MITM).
SSH_OPTS=(-o "ControlPath=$SSH_SOCK" -o StrictHostKeyChecking=accept-new)

cleanup() {
  echo "==> Lokale Docker-Artefakte aufräumen..."
  rm -f "$ARCHIVE"
  docker rmi "$IMAGE" >/dev/null 2>&1 || true
  docker image prune -f >/dev/null 2>&1
  docker builder prune -f >/dev/null 2>&1
  ssh -O exit -o ControlPath="$SSH_SOCK" "$NAS" 2>/dev/null || true
}
trap cleanup EXIT

echo "==> SSH-Verbindung herstellen (einmalige Passwort-Eingabe)..."
ssh -fNM -p "$NAS_PORT" -o ControlMaster=yes "${SSH_OPTS[@]}" "$NAS"

echo "==> Image bauen (linux/amd64)..."
# Pin the SW cache version to the git commit: same commit = same pages-/static-
# <id>, so a redeploy of the same commit doesn't needlessly re-warm caches, and
# distinct commits rotate. Empty (no git) is fine — next.config.ts falls back to
# a random id. Short SHA is hex-only, safe to interpolate.
SW_BUILD_ID="$(git -C "$SCRIPT_DIR/.." rev-parse --short HEAD 2>/dev/null || true)"
docker build --platform linux/amd64 --build-arg SW_BUILD_ID="$SW_BUILD_ID" -t "$IMAGE" .

echo "==> Image exportieren..."
docker save "$IMAGE" | gzip > "$ARCHIVE"
# Security: checksum to detect a corrupted/tampered archive before it is loaded.
CHECKSUM=$(shasum -a 256 "$ARCHIVE" | awk '{print $1}')

echo "==> Image auf NAS kopieren..."
ssh "${SSH_OPTS[@]}" "$NAS" "mkdir -p $R_REMOTE_DIR/data"
scp -O "${SSH_OPTS[@]}" "$ARCHIVE" "$NAS:/tmp/$R_ARCHIVE"

echo "==> Prüfsumme verifizieren..."
ssh "${SSH_OPTS[@]}" "$NAS" "echo '$CHECKSUM  /tmp/$R_ARCHIVE' | sha256sum -c -"

echo "==> Auf NAS: Image laden & Container neu starten..."
scp -O "${SSH_OPTS[@]}" docker-compose.yml "$NAS:$R_REMOTE_DIR/docker-compose.yml"
ssh "${SSH_OPTS[@]}" "$NAS" "
  export PATH=/usr/local/bin:/usr/syno/bin:\$PATH && \
  mv /tmp/$R_ARCHIVE $R_REMOTE_DIR/$R_ARCHIVE && \
  docker load -i $R_REMOTE_DIR/$R_ARCHIVE && \
  rm $R_REMOTE_DIR/$R_ARCHIVE && \
  docker rm -f $R_CONTAINER 2>/dev/null || true && \
  cd $R_REMOTE_DIR && \
  docker compose up -d --force-recreate && \
  docker image prune -f
"

echo "==> Fertig. App erreichbar unter http://$NAS:3000"
