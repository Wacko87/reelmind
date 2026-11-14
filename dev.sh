#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Iniciando ReelMind en modo Desarrollo Local..."

# Asegurar entorno virtual
if [ ! -d "$DIR/backend/.venv" ]; then
    echo "📦 Creando entorno virtual Python..."
    python3 -m venv "$DIR/backend/.venv"
    source "$DIR/backend/.venv/bin/activate"
    pip install -r "$DIR/backend/requirements.txt"
fi

# Inicializar y sembrar base de datos si es necesario
source "$DIR/backend/.venv/bin/activate"
cd "$DIR/backend"
python3 -m app.seed

# Arrancar backend en segundo plano
echo "⚡ Arrancando Backend FastAPI en http://localhost:8000..."
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!

# Arrancar frontend
echo "🎨 Arrancando Frontend Vite en http://localhost:5173..."
cd "$DIR/frontend"
npm run dev &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true" EXIT

wait
