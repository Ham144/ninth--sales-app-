#!/bin/bash
# Menghentikan script jika ada perintah yang error
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"

echo "🚀 Memulai Deployment midcsi (+ System Hub) ke 192.168.169.3..."

# PRODUCTION_SERVER="192.168.169.3"
SSH_USER="ham"
# REMOTE_DIR="/home/ham/midcsi"

return 0 
# jangan deploy dulu ke midcsi. ini perubahan besar

# Prompt password SSH jika belum diset
if [ -z "$SSHPASS" ]; then
  read -s -p "🔑 Masukkan password SSH untuk $SSH_USER@$PRODUCTION_SERVER: " SSHPASS
  echo ""
  export SSHPASS
fi

echo "🎨 0. Build System Hub → backend/public (Express static, tanpa nginx)..."
cd "$FRONTEND_DIR"
if [ ! -x ./node_modules/.bin/vite ]; then
  echo "   pnpm install di frontend..."
  CI=true pnpm install
fi
./node_modules/.bin/vite build
cd "$SCRIPT_DIR"

if [ ! -f "$SCRIPT_DIR/public/index.html" ]; then
  echo "❌ Build gagal: public/index.html tidak ada"
  exit 1
fi

echo "📦 1. Mentransfer backend + public ke $PRODUCTION_SERVER..."

# Mentransfer file dan folder satu per satu secara spesifik
sshpass -e rsync -azP --delete \
  -e "ssh -o StrictHostKeyChecking=no" \
  middlewares models routes utils public data \
  index.js package.json package-lock.json \
  $SSH_USER@$PRODUCTION_SERVER:$REMOTE_DIR/

echo "⚙️ 2. Menjalankan perintah di server..."

# Menjalankan perintah remote SSH
sshpass -e ssh -T -o StrictHostKeyChecking=no $SSH_USER@$PRODUCTION_SERVER << 'EOF'
  set -e

  # Load NVM & npm  Environment
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

  cd /home/ham/midcsi

  # Menggunakan npm sesuai dengan environment server
  npm install --legacy-peer-deps

  # Restart PM2
  pm2 restart backend
  pm2 logs --lines 30

EOF

echo "✅ Deployment backend + System Hub selesai!"
echo "   UI: http://$PRODUCTION_SERVER:<PORT>/  (PORT dari .env server)"
