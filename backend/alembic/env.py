"""Alembic environment — async engine, URL taken from the app settings (DATABASE_URL)."""

from __future__ import annotations

import asyncio

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

from app import models  # noqa: F401  (register tables on Base.metadata)
from app.core.config import settings
from app.core.db import Base

target_metadata = Base.metadata


def _configure(connection=None, url=None) -> None:
    context.configure(
        connection=connection,
        url=url,
        target_metadata=target_metadata,
        render_as_batch=True,  # SQLite needs batch mode for ALTER TABLE
        compare_type=True,
    )


def run_offline() -> None:
    _configure(url=settings.database_url)
    with context.begin_transaction():
        context.run_migrations()


async def run_online() -> None:
    engine = create_async_engine(settings.database_url, poolclass=pool.NullPool, connect_args=settings.db_connect_args)
    async with engine.connect() as conn:
        await conn.run_sync(lambda sync_conn: (_configure(connection=sync_conn), _run(sync_conn)))
    await engine.dispose()


def _run(_conn) -> None:
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    run_offline()
else:
    asyncio.run(run_online())
