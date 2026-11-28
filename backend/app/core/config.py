"""Runtime configuration, read once from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

BACKEND_DIR = Path(__file__).resolve().parents[2]


def _env(name: str, default: str = "") -> str:
    value = os.getenv(name)
    return value.strip() if value and value.strip() else default


def _bool(name: str, default: bool = False) -> bool:
    return _env(name, str(default)).lower() in {"1", "true", "yes", "on"}


def _int(name: str, default: int) -> int:
    try:
        return int(_env(name, str(default)))
    except ValueError:
        return default


# libpq options that hosted Postgres URLs carry (Neon: ?sslmode=require&channel_binding=require) but asyncpg
# rejects as connect() arguments. sslmode is translated into asyncpg's `ssl`; the rest are dropped.
_LIBPQ_ONLY = {"sslmode", "channel_binding", "sslrootcert", "sslcert", "sslkey", "target_session_attrs", "gssencmode"}


def split_db_url(url: str) -> tuple[str, str | None]:
    """Accept the plain Postgres URL Neon/Supabase/Railway give you: pick the async driver and pull out sslmode."""
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://") :]
    if not url.startswith("postgresql+asyncpg://"):
        return url, None
    parts = urlsplit(url)
    query = parse_qsl(parts.query, keep_blank_values=True)
    sslmode = next((v for k, v in query if k == "sslmode"), None)
    kept = [(k, v) for k, v in query if k not in _LIBPQ_ONLY]
    return urlunsplit(parts._replace(query=urlencode(kept))), sslmode


def normalize_db_url(url: str) -> str:
    return split_db_url(url)[0]


def _db_env() -> str:
    return _env("DATABASE_URL", "sqlite+aiosqlite:///./guardai_dev.db")


@dataclass(frozen=True)
class Settings:
    env: str = field(default_factory=lambda: _env("APP_ENV", "development"))
    database_url: str = field(default_factory=lambda: split_db_url(_db_env())[0])
    database_sslmode: str | None = field(default_factory=lambda: split_db_url(_db_env())[1])

    # --- Clerk -------------------------------------------------------------------------------
    clerk_issuer: str = field(default_factory=lambda: _env("CLERK_ISSUER").rstrip("/"))
    clerk_jwks_url: str = field(default_factory=lambda: _env("CLERK_JWKS_URL"))
    clerk_secret_key: str = field(default_factory=lambda: _env("CLERK_SECRET_KEY"))
    clerk_api_url: str = field(default_factory=lambda: _env("CLERK_API_URL", "https://api.clerk.com/v1"))

    # --- Web -----------------------------------------------------------------------------------
    cors_origins: list[str] = field(
        default_factory=lambda: [
            o.strip().rstrip("/") for o in _env("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()
        ]
    )
    frontend_url: str = field(default_factory=lambda: _env("FRONTEND_URL", "http://localhost:3000").rstrip("/"))
    # Local development only: trust an `X-Dev-User: <id>` header instead of Clerk.
    dev_auth: bool = field(default_factory=lambda: _bool("DEV_AUTH"))

    # --- Storage -------------------------------------------------------------------------------
    supabase_url: str = field(default_factory=lambda: _env("SUPABASE_URL").rstrip("/"))
    supabase_service_key: str = field(default_factory=lambda: _env("SUPABASE_SERVICE_ROLE_KEY"))
    supabase_bucket: str = field(default_factory=lambda: _env("SUPABASE_BUCKET", "evidence"))
    local_upload_dir: str = field(default_factory=lambda: _env("LOCAL_UPLOAD_DIR", "./uploads"))
    # Any S3-compatible object store (Backblaze B2, Cloudflare R2, AWS S3...). Takes precedence over Supabase.
    # For R2 you can instead set R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET.
    s3_endpoint: str = field(
        default_factory=lambda: _env("S3_ENDPOINT")
        or (f"https://{_env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com" if _env("R2_ACCOUNT_ID") else "")
    )
    s3_region: str = field(default_factory=lambda: _env("S3_REGION") or ("auto" if _env("R2_ACCOUNT_ID") else "us-east-1"))
    s3_access_key_id: str = field(default_factory=lambda: _env("S3_ACCESS_KEY_ID") or _env("R2_ACCESS_KEY_ID"))
    s3_secret_access_key: str = field(default_factory=lambda: _env("S3_SECRET_ACCESS_KEY") or _env("R2_SECRET_ACCESS_KEY"))
    s3_bucket: str = field(default_factory=lambda: _env("S3_BUCKET") or _env("R2_BUCKET", "guardai-evidence"))

    # --- AI proctoring -------------------------------------------------------------------------
    ml_enabled: bool = field(default_factory=lambda: _bool("ML_ENABLED", True))
    model_dir: Path = field(default_factory=lambda: Path(_env("MODEL_DIR", str(BACKEND_DIR / "models"))))
    # Frames analysed in parallel. On a 1 vCPU Railway box keep this at 1-2.
    ml_concurrency: int = field(default_factory=lambda: max(1, _int("ML_CONCURRENCY", 2)))
    # Base interval the browser waits between frames; raised automatically under load.
    frame_interval_ms: int = field(default_factory=lambda: max(500, _int("FRAME_INTERVAL_MS", 1000)))

    # --- Email (contact form) ------------------------------------------------------------------
    resend_api_key: str = field(default_factory=lambda: _env("RESEND_API_KEY"))
    # Brevo (300 emails/day free; send from one verified address, no domain needed). Preferred when both are set.
    brevo_api_key: str = field(default_factory=lambda: _env("BREVO_API_KEY"))
    contact_to: str = field(default_factory=lambda: _env("CONTACT_TO"))
    contact_from: str = field(default_factory=lambda: _env("CONTACT_FROM", "Guard AI <onboarding@resend.dev>"))
    # --- Teacher assistant (Groq, OpenAI-compatible) -------------------------------------------
    groq_api_key: str = field(default_factory=lambda: _env("GROQ_API_KEY"))
    groq_model: str = field(default_factory=lambda: _env("GROQ_MODEL", "openai/gpt-oss-120b"))
    # Used when the main model is rate limited (free Groq keys have a separate per-model token budget).
    groq_fallback_model: str = field(default_factory=lambda: _env("GROQ_FALLBACK_MODEL", "openai/gpt-oss-20b"))
    # Sender for student invitations, on a domain verified in Resend (e.g. "Guard AI <invites@yourdomain.com>").
    # When unset, Clerk sends its own invitation email instead.
    email_from: str = field(default_factory=lambda: _env("EMAIL_FROM"))

    @property
    def email_provider(self) -> str | None:
        return "brevo" if self.brevo_api_key else "resend" if self.resend_api_key else None

    @property
    def branded_invites(self) -> bool:
        return bool(self.email_provider and self.email_from)

    @property
    def jwks_url(self) -> str:
        if self.clerk_jwks_url:
            return self.clerk_jwks_url
        return f"{self.clerk_issuer}/.well-known/jwks.json" if self.clerk_issuer else ""

    @property
    def use_s3(self) -> bool:
        return bool(self.s3_endpoint and self.s3_access_key_id and self.s3_secret_access_key)

    @property
    def use_supabase_storage(self) -> bool:
        return not self.use_s3 and bool(self.supabase_url and self.supabase_service_key)

    @property
    def db_connect_args(self) -> dict:
        if not self.is_postgres:
            return {}
        # Poolers (Neon, Supabase pgbouncer) run in transaction mode: no prepared statement caching.
        args: dict = {"statement_cache_size": 0, "prepared_statement_cache_size": 0}
        if self.database_sslmode and self.database_sslmode != "disable":
            args["ssl"] = "require"
        return args

    @property
    def storage_backend(self) -> str:
        return "s3" if self.use_s3 else "supabase" if self.use_supabase_storage else "local"

    @property
    def is_postgres(self) -> bool:
        return self.database_url.startswith("postgresql")


settings = Settings()
