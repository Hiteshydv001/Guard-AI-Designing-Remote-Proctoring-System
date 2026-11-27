# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------- models (cached layer)
FROM python:3.12-slim AS models
WORKDIR /build
COPY scripts/download_models.py .
RUN python download_models.py /models

# ---------------------------------------------------------------- runtime
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    MODEL_DIR=/app/models \
    OMP_NUM_THREADS=1
WORKDIR /app

COPY requirements.txt requirements-mediapipe.txt ./
RUN pip install -r requirements.txt \
 && pip install --no-deps -r requirements-mediapipe.txt

COPY --from=models /models ./models
COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

RUN useradd --create-home --uid 10001 guardai && mkdir -p /app/uploads && chown -R guardai /app
USER guardai

EXPOSE 8000
# Railway injects $PORT. Migrations run on startup (app lifespan). One worker: the AI runtime is in-process.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*' --timeout-keep-alive 30"]
