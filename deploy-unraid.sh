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

# 2. Sincronizar archivos excluyendo temporales, node_modules y venv
echo "📦 Sincronizando archivos hacia $REMOTE_DIR..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.venv' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude '.git' \
  --exclude 'backend/data/temp' \
  --exclude 'backend/data/reelmind.db' \
  --exclude 'dist' \
  "$LOCAL_DIR/" "$UNRAID_USER@$UNRAID_HOST:$REMOTE_DIR/"

# 3. Construir y levantar el contenedor Docker en Unraid
echo "🐳 Levantando contenedor Docker en Unraid..."
ssh "$UNRAID_USER@$UNRAID_HOST" "cd $REMOTE_DIR && docker compose down 2>/dev/null || true && docker compose up -d --build"

echo "✅ Despliegue completado con éxito."
echo "🌐 ReelMind está disponible localmente en: http://$UNRAID_HOST:8085"
echo "🔒 Configura tu Proxy Host en Nginx Proxy Manager apuntando a http://192.168.7.160:8085 con tu subdominio (ej: reels.wacko87.es)"
