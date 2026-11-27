"""Enable row level security on every table (Postgres / Supabase only).

Supabase exposes the public schema through its auto-generated REST API. Enabling RLS with no policies
denies that path completely; this API connects as the table owner and is unaffected.

Revision ID: 0002
Revises: 0001
"""
from __future__ import annotations

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

TABLES = [
    "profiles", "roster_entries", "batches", "batch_members", "invites", "exams", "exam_batches",
    "questions", "attempts", "violations", "proctor_messages",
]


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    for table in TABLES:
        op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    for table in TABLES:
        op.execute(f'ALTER TABLE "{table}" DISABLE ROW LEVEL SECURITY')
