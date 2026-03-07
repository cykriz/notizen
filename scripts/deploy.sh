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
  docker rmi "$IMAGE" 2>/dev/null || true
  docker image prune -f
  docker builder prune -f
}
trap cleanup EXIT

echo "==> Image bauen (linux/amd64)..."
docker build --platform linux/amd64 -t "$IMAGE" .

echo "==> Image exportieren..."
docker save "$IMAGE" | gzip > "$ARCHIVE"

echo "==> Image auf NAS kopieren..."
scp "$ARCHIVE" "$NAS:$REMOTE_DIR/$ARCHIVE"

echo "==> Auf NAS: Image laden & Container neu starten..."
ssh "$NAS" "
  docker load -i $REMOTE_DIR/$ARCHIVE && \
  rm $REMOTE_DIR/$ARCHIVE && \
  docker stop $CONTAINER 2>/dev/null || true && \
  docker rm $CONTAINER 2>/dev/null || true && \
  docker run -d \
    --name $CONTAINER \
    --restart always \
    -p 3000:3000 \
    -v $REMOTE_DIR/notes:/app/data \
    -e NOTES_ROOT=/app/data \
    $IMAGE && \
  docker image prune -f
"

echo "==> Fertig. App erreichbar unter http://ds:3000"
