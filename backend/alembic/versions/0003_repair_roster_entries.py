"""Create roster_entries on databases built from an early draft of 0001 that lacked it.

A no-op wherever the table already exists. When it has to be created, existing students are
backfilled onto the roster of the proctor who created them or whose batch they belong to.

Revision ID: 0003
Revises: 0002
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if sa.inspect(bind).has_table("roster_entries"):
        return

    op.create_table(
        "roster_entries",
        sa.Column("proctor_id", sa.String(length=64), nullable=False),
        sa.Column("candidate_id", sa.String(length=64), nullable=False),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["candidate_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["proctor_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("proctor_id", "candidate_id"),
    )
    with op.batch_alter_table("roster_entries", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_roster_entries_candidate_id"), ["candidate_id"], unique=False)

    op.execute(
        """
        INSERT INTO roster_entries (proctor_id, candidate_id, added_at)
        SELECT DISTINCT pairs.proctor_id, pairs.candidate_id, CURRENT_TIMESTAMP FROM (
            SELECT created_by AS proctor_id, id AS candidate_id FROM profiles
            WHERE created_by IS NOT NULL AND role = 'candidate'
            UNION
            SELECT b.proctor_id, m.candidate_id FROM batch_members m JOIN batches b ON b.id = m.batch_id
        ) AS pairs
        WHERE pairs.proctor_id IN (SELECT id FROM profiles)
          AND pairs.candidate_id IN (SELECT id FROM profiles)
        """
    )
    if bind.dialect.name == "postgresql":
        op.execute('ALTER TABLE "roster_entries" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    # The table belongs to 0001's schema; leave it in place.
    pass
