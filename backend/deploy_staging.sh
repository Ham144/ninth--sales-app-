#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/../frontend" && pwd)"

echo "Build System Hub → backend/public (Express static di :7047)"
cd "$FRONTEND_DIR"
if [ ! -x ./node_modules/.bin/vite ]; then
  CI=true pnpm install
fi
./node_modules/.bin/vite build

if [ ! -f "$SCRIPT_DIR/public/index.html" ]; then
  echo "Build gagal: public/index.html tidak ada"
  exit 1
fi

# nodemon hanya me-reload JS; sentuh index agar proses baca ulang folder public
touch "$SCRIPT_DIR/index.js"
echo "Staging: http://192.168.169.12:7047/"
