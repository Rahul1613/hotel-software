# Multi-stage Docker build for Hotel Ekdant Restaurant Management System

# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python Backend & Final Hardened Image
FROM python:3.11-slim
WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    libjpeg-dev \
    zlib1g-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend assets from stage 1 into frontend/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Security: Create non-root user
RUN adduser --disabled-password --gecos "" ekdantuser && \
    mkdir -p /app/backend/uploads && \
    chown -R ekdantuser:ekdantuser /app

USER ekdantuser

WORKDIR /app/backend

ENV PORT=10000
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/backend
ENV FLASK_ENV=production

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:10000/healthz || exit 1

# Production Gunicorn with 1 worker for Socket.IO threading stability
CMD ["gunicorn", "--worker-class", "gthread", "--workers", "1", "--threads", "8", "--bind", "0.0.0.0:10000", "app.main:app"]
