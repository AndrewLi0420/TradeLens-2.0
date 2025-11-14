"""Add index on stocks.company_name for search performance

Revision ID: add_stocks_company_name_index
Revises: add_user_stock_tracking
Create Date: 2025-01-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'add_stocks_company_name_index'
down_revision: Union[str, Sequence[str], None] = 'add_user_stock_tracking'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create index on company_name for search performance
    op.create_index('ix_stocks_company_name', 'stocks', ['company_name'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_stocks_company_name', table_name='stocks')


