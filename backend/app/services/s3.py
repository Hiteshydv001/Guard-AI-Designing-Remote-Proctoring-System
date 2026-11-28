"""S3-compatible object storage client (Backblaze B2, Cloudflare R2, AWS S3...): upload and presigned download
with AWS Signature V4, using path-style URLs (https://endpoint/bucket/key).

Only the operations Guard AI needs, implemented directly to keep boto3 (and its memory) out of the image.
The signing is checked against botocore's reference signer in tests/test_s3.py.
"""

from __future__ import annotations

import hashlib
import hmac
from datetime import UTC, datetime
from urllib.parse import quote

import httpx

SERVICE = "s3"
ALGORITHM = "AWS4-HMAC-SHA256"
UNSIGNED = "UNSIGNED-PAYLOAD"


def _hmac(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode(), hashlib.sha256).digest()


def _uri(s: str, safe: str = "") -> str:
    return quote(s, safe="-_.~" + safe)


class S3Store:
    def __init__(self, endpoint: str, region: str, access_key: str, secret_key: str, bucket: str):
        if "://" not in endpoint:
            endpoint = "https://" + endpoint
        self.endpoint = endpoint.rstrip("/")
        self.host = self.endpoint.split("://", 1)[1]
        self.region = region
        self.access_key = access_key
        self.secret_key = secret_key
        self.bucket = bucket

    # ---------------------------------------------------------------------------------- signing
    def _path(self, key: str | None) -> str:
        bucket = "/" + _uri(self.bucket)
        return bucket if key is None else bucket + "/" + _uri(key, safe="/")

    def _signature(self, canonical_request: str, stamp: str) -> str:
        day = stamp[:8]
        k = _hmac(("AWS4" + self.secret_key).encode(), day)
        for part in (self.region, SERVICE, "aws4_request"):
            k = _hmac(k, part)
        scope = f"{day}/{self.region}/{SERVICE}/aws4_request"
        to_sign = "\n".join([ALGORITHM, stamp, scope, hashlib.sha256(canonical_request.encode()).hexdigest()])
        return hmac.new(k, to_sign.encode(), hashlib.sha256).hexdigest()

    def presign_get(self, key: str, expires: int = 3600, now: datetime | None = None) -> str:
        """A time-limited URL anyone can GET (evidence thumbnails in the proctor's browser)."""
        stamp = (now or datetime.now(UTC)).strftime("%Y%m%dT%H%M%SZ")
        scope = f"{stamp[:8]}/{self.region}/{SERVICE}/aws4_request"
        params = {
            "X-Amz-Algorithm": ALGORITHM,
            "X-Amz-Credential": f"{self.access_key}/{scope}",
            "X-Amz-Date": stamp,
            "X-Amz-Expires": str(min(max(expires, 1), 604800)),
            "X-Amz-SignedHeaders": "host",
        }
        query = "&".join(f"{_uri(k)}={_uri(v)}" for k, v in sorted(params.items()))
        path = self._path(key)
        canonical = "\n".join(["GET", path, query, f"host:{self.host}\n", "host", UNSIGNED])
        return f"{self.endpoint}{path}?{query}&X-Amz-Signature={self._signature(canonical, stamp)}"

    def _signed_headers(self, method: str, key: str | None, body: bytes, extra: dict[str, str], now: datetime) -> dict[str, str]:
        """Headers for a signed request on an object (`key`) or, with key=None, the bucket itself."""
        stamp = now.strftime("%Y%m%dT%H%M%SZ")
        payload_hash = hashlib.sha256(body).hexdigest()
        headers = {"host": self.host, "x-amz-content-sha256": payload_hash, "x-amz-date": stamp, **extra}
        lower = {k.lower(): v.strip() for k, v in headers.items()}
        names = sorted(lower)
        canonical_headers = "".join(f"{n}:{lower[n]}\n" for n in names)
        canonical = "\n".join([method, self._path(key), "", canonical_headers, ";".join(names), payload_hash])
        scope = f"{stamp[:8]}/{self.region}/{SERVICE}/aws4_request"
        signature = self._signature(canonical, stamp)
        out = {k: v for k, v in headers.items() if k != "host"}
        out["Authorization"] = (
            f"{ALGORITHM} Credential={self.access_key}/{scope}, SignedHeaders={';'.join(names)}, Signature={signature}"
        )
        return out

    # ---------------------------------------------------------------------------------- requests
    async def put(self, key: str, data: bytes, content_type: str = "image/jpeg") -> bool:
        headers = self._signed_headers("PUT", key, data, {"content-type": content_type}, datetime.now(UTC))
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.put(f"{self.endpoint}{self._path(key)}", content=data, headers=headers)
        return res.is_success

    async def bucket_reachable(self) -> tuple[bool, str]:
        """HEAD the bucket so a wrong key or bucket name shows up in the startup log, not mid-exam."""
        headers = self._signed_headers("HEAD", None, b"", {}, datetime.now(UTC))
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                res = await client.head(f"{self.endpoint}{self._path(None)}", headers=headers)
        except httpx.HTTPError as exc:
            return False, str(exc)
        return res.is_success, f"HTTP {res.status_code}"
