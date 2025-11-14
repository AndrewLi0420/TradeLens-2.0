"""Add pg_trgm extension for fuzzy search

Revision ID: add_pg_trgm_extension
Revises: add_stocks_company_name_index
Create Date: 2025-01-27 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'add_pg_trgm_extension'
down_revision: Union[str, Sequence[str], None] = 'add_stocks_company_name_index'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Install pg_trgm extension for fuzzy matching support
    # This enables similarity() function for typo-tolerant search
    op.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm')


def downgrade() -> None:
    """Downgrade schema."""
    # Drop the extension
    op.execute('DROP EXTENSION IF EXISTS pg_trgm')


