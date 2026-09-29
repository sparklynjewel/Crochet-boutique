# syntax=docker/dockerfile:1
FROM python:3.13-slim

WORKDIR /app

# Install Node.js so we can build the React frontend
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install and build the frontend
COPY frontend/package.json frontend/package-lock.json frontend/
RUN cd frontend && npm ci
COPY frontend/ frontend/
RUN cd frontend && npm run build

# Install Python backend
COPY backend/requirements.txt backend/
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/

WORKDIR /app/backend

# Default DB path; override with DATABASE_PATH in production if needed
ENV DATABASE_PATH=/app/backend/todos.db

EXPOSE 5000
CMD gunicorn app:app --bind 0.0.0.0:${PORT:-5000}
