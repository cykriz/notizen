#!/usr/bin/env sh
set -e

NAS="user@nas"
IMAGE="notizen"
ARCHIVE="notizen.tar.gz"
REMOTE_DIR="/volume1/docker/app"
CONTAINER="notizen"

cleanup() {
  echo "==> Lokale Docker-Artefakte aufräumen..."
  rm -f "$ARCHIVE"
  docker rmi "$IMAGE" >/dev/null 2>&1 || true
  docker image prune -f >/dev/null 2>&1
  docker builder prune -f >/dev/null 2>&1
}
trap cleanup EXIT

echo "==> Image bauen (linux/amd64)..."
docker build --platform linux/amd64 -t "$IMAGE" .

echo "==> Image exportieren..."
docker save "$IMAGE" | gzip > "$ARCHIVE"

echo "==> Image auf NAS kopieren..."
ssh "$NAS" "mkdir -p $REMOTE_DIR/data"
scp -O "$ARCHIVE" "$NAS:/tmp/$ARCHIVE"

echo "==> Auf NAS: Image laden & Container neu starten..."
scp -O docker-compose.yml "$NAS:$REMOTE_DIR/docker-compose.yml"
ssh "$NAS" "
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
