"""Add sentiment_score column to recommendations table

Revision ID: add_sentiment_score_to_recommendations
Revises: add_pg_trgm_extension
Create Date: 2025-11-14 07:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'add_sentiment_score'
down_revision: Union[str, Sequence[str], None] = 'add_pg_trgm_extension'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add sentiment_score column to recommendations table
    # This column stores the aggregated sentiment score used at generation time
    # It's nullable for backward compatibility with existing recommendations
    op.add_column(
        'recommendations',
        sa.Column('sentiment_score', sa.Numeric(precision=5, scale=4), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('recommendations', 'sentiment_score')

