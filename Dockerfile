# --- Stage 1: Compilar Frontend ---
FROM node:22-alpine AS frontend-builder
WORKDIR /build

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# --- Stage 2: Backend Python + Runtime ---
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    DATA_DIR=/data \
    PORT=8000 \
    HOST=0.0.0.0

# Instalar ffmpeg (necesario para extracción de audio con yt-dlp) y curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias Python
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copiar código del backend
COPY backend/app ./app

# Copiar el frontend compilado desde el Stage 1
COPY --from=frontend-builder /build/dist /app/frontend/dist

# Crear directorio de datos
RUN mkdir -p /data

EXPOSE 8000

VOLUME ["/data"]

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
