from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .config import BACKEND_DIR, settings

log = logging.getLogger("guardai.db")

if settings.is_postgres:
    engine = create_async_engine(
        settings.database_url,
        connect_args=settings.db_connect_args,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
    )
else:
    engine = create_async_engine(settings.database_url)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


def _upgrade_head() -> None:
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(cfg, "head")


async def run_migrations() -> None:
    """Apply Alembic migrations. Runs in a worker thread because Alembic's env drives its own loop."""
    await asyncio.to_thread(_upgrade_head)
    log.info("Database migrations are up to date")
