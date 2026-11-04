#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$ROOT/data/qdrant"
BIN="$DATA/qdrant"
VERSION="v1.20.0"
PORT="${QDRANT_HTTP_PORT:-6333}"
mkdir -p "$DATA/storage"

if curl -sf "http://127.0.0.1:${PORT}/readyz" >/dev/null 2>&1; then
  echo "Qdrant sudah jalan di :${PORT}"
  exit 0
fi

if docker info >/dev/null 2>&1; then
  docker compose -f "$ROOT/infra/qdrant/docker-compose.yml" up -d
  echo "Qdrant via Docker di :6333"
  exit 0
fi

if [[ ! -x "$BIN" ]]; then
  echo "Docker daemon tidak aktif; unduh binary Qdrant ${VERSION}"
  ARCHIVE="$DATA/qdrant-x86_64-unknown-linux-musl.tar.gz"
  curl -fsSL -o "$ARCHIVE" \
    "https://github.com/qdrant/qdrant/releases/download/${VERSION}/qdrant-x86_64-unknown-linux-musl.tar.gz"
  tar -xzf "$ARCHIVE" -C "$DATA"
  rm -f "$ARCHIVE"
  chmod +x "$BIN"
fi

export QDRANT__SERVICE__HTTP_PORT="${PORT}"
export QDRANT__SERVICE__HOST="127.0.0.1"
export QDRANT__STORAGE__STORAGE_PATH="$DATA/storage"
cd "$DATA"
nohup "$BIN" --disable-telemetry >/tmp/qdrant.log 2>&1 &
echo $! > "$DATA/qdrant.pid"

for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if curl -sf "http://127.0.0.1:${PORT}/readyz" >/dev/null 2>&1; then
    echo "Qdrant binary pid $(cat "$DATA/qdrant.pid") di :${PORT}"
    exit 0
  fi
  sleep 0.4
done
echo "Qdrant gagal start; lihat /tmp/qdrant.log" >&2
exit 1
