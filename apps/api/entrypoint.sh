#!/bin/bash
set -e

echo "[entrypoint] Running database migrations..."
python3 /app/api/migrate.py

echo "[entrypoint] Starting API server..."
exec gunicorn api.main:app \
  -k uvicorn.workers.UvicornWorker \
  --workers 2 \
  --bind 0.0.0.0:8000 \
  --timeout 120 \
  --graceful-timeout 30 \
  --access-logfile -
