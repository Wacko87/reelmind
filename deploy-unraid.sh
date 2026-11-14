#!/usr/bin/env bash
set -e

UNRAID_HOST="192.168.7.160"
UNRAID_USER="root"
# Importante: Usar /mnt/cache directo en lugar de /mnt/user (FUSE) para SQLite WAL de alto rendimiento y evitar bloqueos shm
REMOTE_DIR="/mnt/cache/appdata/reelmind"
LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Desplegando ReelMind en Unraid ($UNRAID_HOST)..."

# 1. Crear directorio remoto en el pool de caché NVMe
ssh "$UNRAID_USER@$UNRAID_HOST" "mkdir -p $REMOTE_DIR/data"

# 2. Sincronizar archivos excluyendo datos persistentes, temporales y dependencias
echo "📦 Sincronizando archivos hacia $REMOTE_DIR..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.venv' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude '.git' \
  --exclude 'data' \
  --exclude 'data/' \
  --exclude 'data/**' \
  --exclude 'backend/data' \
  --exclude 'backend/data/**' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'dist' \
  "$LOCAL_DIR/" "$UNRAID_USER@$UNRAID_HOST:$REMOTE_DIR/"

# 3. Construir y levantar el contenedor Docker en Unraid preservando volúmenes
echo "🐳 Levantando contenedor Docker en Unraid..."
ssh "$UNRAID_USER@$UNRAID_HOST" "cd $REMOTE_DIR && docker compose up -d --build"

echo "✅ Despliegue completado con éxito."
echo "🌐 ReelMind está disponible en red br0.11: http://192.168.11.237:8000"
echo "🔒 Proxy Host en Nginx Proxy Manager: https://reels.wacko87.es (o https://reelmind.wacko87.es)"
