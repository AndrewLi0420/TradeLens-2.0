from fastapi_users.exceptions import UserAlreadyExists

from .core.config import settings
from app.core.logger import logger
from .users.schemas import UserCreate
from .users.utils import create_user
from app.db.config import async_session_maker
from app.services.stock_import_service import import_fortune_500_stocks
from app.crud.stocks import get_stock_count


async def create_superuser() -> None:
    try:
        user = await create_user(
            UserCreate(
                email=settings.FIRST_SUPERUSER_EMAIL,
                password=settings.FIRST_SUPERUSER_PASSWORD,
                is_superuser=True,
                is_verified=True,
                is_active=True,
            )
        )
        logger.info(f"User {user} created")
    except UserAlreadyExists:
        logger.info(f"User {settings.FIRST_SUPERUSER_EMAIL} already exists")


async def load_fortune_500_stocks() -> None:
    """Load S&P 500 stocks into database (idempotent)"""
    async with async_session_maker() as session:
        # Check if stocks already exist
        existing_count = await get_stock_count(session)
        
        if existing_count > 0:
            logger.info(
                f"Stocks already loaded: {existing_count} stocks found. Skipping import."
            )
            return
        
        try:
            logger.info("Loading S&P 500 stocks...")
            stats = await import_fortune_500_stocks(session)
            logger.info(
                f"S&P 500 stocks loaded: {stats['imported']} imported, "
                f"{stats['updated']} updated, {stats['errors']} errors"
            )
        except Exception as e:
            logger.error(f"Error loading S&P 500 stocks: {e}")
            raise
