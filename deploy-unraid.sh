#!/usr/bin/env bash
set -e

LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Cargar configuración personalizada si existe localmente (ignorado en git)
if [ -f "$LOCAL_DIR/.env.deploy" ]; then
  # shellcheck source=/dev/null
  source "$LOCAL_DIR/.env.deploy"
fi

UNRAID_HOST="${UNRAID_HOST:-tu-servidor-unraid}"
UNRAID_USER="${UNRAID_USER:-root}"
# Importante: Usar /mnt/cache directo en lugar de /mnt/user (FUSE) para SQLite WAL de alto rendimiento y evitar bloqueos shm
REMOTE_DIR="${REMOTE_DIR:-/mnt/cache/appdata/reelmind}"

echo "🚀 Desplegando ReelMind en Unraid ($UNRAID_HOST)..."

# 1. Crear directorio remoto en el pool de caché NVMe y respaldo de seguridad
ssh "$UNRAID_USER@$UNRAID_HOST" "mkdir -p $REMOTE_DIR/data && if [ -f $REMOTE_DIR/data/reelmind.db ]; then cp $REMOTE_DIR/data/reelmind.db $REMOTE_DIR/data/reelmind.db.bak_\$(date +%Y%m%d_%H%M%S) && echo '✅ Respaldo preventivo guardado en Unraid'; fi"

# 2. Sincronizar archivos excluyendo datos persistentes, temporales y dependencias
echo "📦 Sincronizando archivos hacia $REMOTE_DIR..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude 'frontend/node_modules' \
  --exclude '.venv' \
  --exclude 'backend/.venv' \
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
  --exclude 'docker-compose.yml' \
  --exclude 'dist' \
  --exclude 'frontend/dist' \
  "$LOCAL_DIR/" "$UNRAID_USER@$UNRAID_HOST:$REMOTE_DIR/"

# 3. Construir y levantar el contenedor Docker en Unraid preservando volúmenes y red
echo "🐳 Levantando contenedor Docker en Unraid..."
ssh "$UNRAID_USER@$UNRAID_HOST" "cd $REMOTE_DIR && docker compose up -d --build"

echo "✅ Despliegue completado con éxito."
echo "🌐 ReelMind está disponible en el puerto configurado (ej: http://tu-servidor:8000)"
echo "🔒 Configura tu Proxy Host en Nginx Proxy Manager o tu reverse proxy preferido."
