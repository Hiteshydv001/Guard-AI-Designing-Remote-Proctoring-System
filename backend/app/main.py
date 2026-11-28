"""Guard AI API — FastAPI app served on Railway."""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from contextlib import asynccontextmanager
from html import escape

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .api import assistant, candidate, exams, me, monitor, students
from .core.config import settings
from .core.db import run_migrations
from .ml.runtime import runtime
from .schemas import ContactIn
from .services.email import Email, EmailError, send_email
from .services.storage import ensure_bucket

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("guardai")


async def _sweeper() -> None:
    while True:
        await asyncio.sleep(60)
        runtime.sweep()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await run_migrations()
    try:
        await ensure_bucket()
    except Exception as exc:  # storage problems must not stop the API from booting
        log.error("Could not verify storage bucket: %s", exc)
    if settings.dev_auth:
        log.warning("DEV_AUTH is enabled — X-Dev-User headers are trusted. Never enable this in production.")
    loader = asyncio.create_task(runtime.load_async())  # health check passes while models load
    sweeper = asyncio.create_task(_sweeper())
    yield
    sweeper.cancel()
    await asyncio.gather(loader, return_exceptions=True)


app = FastAPI(title="Guard AI API", version="2.0.0", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Dev-User"],
    expose_headers=["Content-Disposition", "X-Request-ID"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        log.exception("Unhandled error [%s] %s %s", request_id, request.method, request.url.path)
        response = JSONResponse({"detail": "Internal server error", "request_id": request_id}, status_code=500)
    elapsed = (time.perf_counter() - started) * 1000
    response.headers["X-Request-ID"] = request_id
    if not request.url.path.endswith(("/frames", "/heartbeat", "/health")) or response.status_code >= 400:
        log.info("%s %s -> %s %.0fms [%s]", request.method, request.url.path, response.status_code, elapsed, request_id)
    return response


for module in (me, exams, monitor, students, candidate, assistant):
    app.include_router(module.router)

if settings.storage_backend == "local":
    app.mount("/uploads", StaticFiles(directory=settings.local_upload_dir, check_dir=False), name="uploads")


@app.get("/")
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": app.version,
        "storage": settings.storage_backend,
        "database": "postgres" if settings.is_postgres else "sqlite",
        "ml": runtime.status(),
    }


@app.post("/contact")
async def contact(payload: ContactIn):
    if not (settings.resend_api_key and settings.contact_to):
        raise HTTPException(503, "Contact form is not configured")
    body = "".join(
        f"<p><strong>{label}:</strong> {escape(value)}</p>"
        for label, value in [
            ("Name", f"{payload.firstName} {payload.lastName}"),
            ("Email", payload.email),
            ("Subject", payload.subject),
            ("Message", payload.message),
        ]
    )
    message = Email(subject=f"[Guard AI] {payload.subject[:150]}", html=body, text=payload.message)
    try:
        await send_email(settings.contact_to, message, sender=settings.contact_from, reply_to=payload.email)
    except EmailError as exc:
        raise HTTPException(502, "Could not send your message, please try again later") from exc
    return {"ok": True}
