"""Evidence snapshots and reference photos: Cloudflare R2 or Supabase Storage in production, local disk in dev."""

from __future__ import annotations

import base64
import binascii
import logging
import os
import re

import httpx

from ..core.config import settings
from .r2 import R2

log = logging.getLogger("guardai.storage")
_r2 = (
    R2(settings.r2_account_id, settings.r2_access_key_id, settings.r2_secret_access_key, settings.r2_bucket)
    if settings.use_r2
    else None
)

MAX_SNAPSHOT_BYTES = 600_000


def decode_data_url(data_url: str | None) -> bytes | None:
    if not data_url:
        return None
    payload = data_url.split(",", 1)[1] if data_url.startswith("data:") else data_url
    try:
        raw = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError):
        return None
    return raw if 0 < len(raw) <= MAX_SNAPSHOT_BYTES else None


_KEY_PART = re.compile(r"[^A-Za-z0-9._-]+")


def safe_key(path: str) -> str:
    """Normalise a storage key: only [A-Za-z0-9._-] in each segment, no empty, '.' or '..' segments."""
    parts = [_KEY_PART.sub("_", p).strip(".") for p in path.replace("\\", "/").split("/")]
    parts = [p for p in parts if p]
    if not parts:
        raise ValueError("Empty storage key")
    return "/".join(parts)


def _local_path(key: str) -> str:
    root = os.path.realpath(settings.local_upload_dir)
    full = os.path.realpath(os.path.join(root, key))
    if os.path.commonpath([root, full]) != root:
        raise ValueError("Storage key escapes the upload directory")
    return full


def _headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {settings.supabase_service_key}", "apikey": settings.supabase_service_key}


async def ensure_bucket() -> None:
    """Create the private evidence bucket on first boot (no-op if it already exists)."""
    if _r2:
        ok, detail = await _r2.bucket_reachable()
        if ok:
            log.info("Storage: Cloudflare R2 bucket %r", settings.r2_bucket)
        else:
            log.error(
                "Storage: can't reach R2 bucket %r (%s). Check R2_* variables and the token's bucket access.",
                settings.r2_bucket,
                detail,
            )
        return
    if not settings.use_supabase_storage:
        os.makedirs(settings.local_upload_dir, exist_ok=True)
        return
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(f"{settings.supabase_url}/storage/v1/bucket/{settings.supabase_bucket}", headers=_headers())
        if res.is_success:
            return
        await client.post(
            f"{settings.supabase_url}/storage/v1/bucket",
            headers=_headers(),
            json={
                "id": settings.supabase_bucket,
                "name": settings.supabase_bucket,
                "public": False,
                "file_size_limit": MAX_SNAPSHOT_BYTES,
                "allowed_mime_types": ["image/jpeg"],
            },
        )


async def save_snapshot(path: str, data: bytes) -> str | None:
    """Store a JPEG and return its storage path (not a public URL)."""
    path = safe_key(path)
    if _r2:
        try:
            return path if await _r2.put(path, data) else None
        except httpx.HTTPError as exc:
            log.warning("R2 upload failed for %s: %s", path, exc)
            return None
    if settings.use_supabase_storage:
        url = f"{settings.supabase_url}/storage/v1/object/{settings.supabase_bucket}/{path}"
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(url, content=data, headers={**_headers(), "Content-Type": "image/jpeg", "x-upsert": "true"})
        return path if res.is_success else None

    full = _local_path(path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "wb") as fh:
        fh.write(data)
    return path


async def signed_urls(paths: list[str], base_url: str, expires_in: int = 3600) -> dict[str, str]:
    """Batch-sign evidence paths (one Supabase round trip instead of one per snapshot)."""
    paths = [p for p in paths if p]
    if not paths:
        return {}
    if _r2:  # presigning is local maths, no network round trip
        return {p: _r2.presign_get(p, expires_in) for p in paths}
    if not settings.use_supabase_storage:
        return {p: f"{base_url.rstrip('/')}/uploads/{p}" for p in paths}
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.post(
            f"{settings.supabase_url}/storage/v1/object/sign/{settings.supabase_bucket}",
            json={"expiresIn": expires_in, "paths": paths},
            headers=_headers(),
        )
    if not res.is_success:
        return {}
    out = {}
    for item in res.json():
        signed = item.get("signedURL") or item.get("signedUrl")
        if signed and item.get("path"):
            out[item["path"]] = f"{settings.supabase_url}/storage/v1{signed}"
    return out
