#!/usr/bin/env sh
set -e

NAS="user@nas"
IMAGE="notizen"
ARCHIVE="notizen.tar.gz"
REMOTE_DIR="/volume1/docker/app"
CONTAINER="notizen"

SSH_SOCK="/tmp/deploy-notizen-ssh-$$"

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
ssh -fNM -o ControlMaster=yes -o ControlPath="$SSH_SOCK" "$NAS"
SSH_OPTS="-o ControlPath=$SSH_SOCK"

echo "==> Image bauen (linux/amd64)..."
docker build --platform linux/amd64 -t "$IMAGE" .

echo "==> Image exportieren..."
docker save "$IMAGE" | gzip > "$ARCHIVE"

echo "==> Image auf NAS kopieren..."
ssh $SSH_OPTS "$NAS" "mkdir -p $REMOTE_DIR/data"
scp -O $SSH_OPTS "$ARCHIVE" "$NAS:/tmp/$ARCHIVE"

echo "==> Auf NAS: Image laden & Container neu starten..."
scp -O $SSH_OPTS docker-compose.yml "$NAS:$REMOTE_DIR/docker-compose.yml"
ssh $SSH_OPTS "$NAS" "
  export PATH=/usr/local/bin:/usr/syno/bin:\$PATH && \
  mv /tmp/$ARCHIVE $REMOTE_DIR/$ARCHIVE && \
  docker load -i $REMOTE_DIR/$ARCHIVE && \
  rm $REMOTE_DIR/$ARCHIVE && \
  docker rm -f $CONTAINER 2>/dev/null || true && \
  cd $REMOTE_DIR && \
  docker compose up -d --force-recreate && \
  docker image prune -f
"

echo "==> Fertig. App erreichbar unter http://ds:3000"
