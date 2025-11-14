"""CRUD operations for user stock tracking"""
from __future__ import annotations

from uuid import UUID
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.models.user_stock_tracking import UserStockTracking
from app.models.stock import Stock
from app.services.tier_service import check_tier_limit
from app.core.logger import logger


async def is_stock_tracked(
    session: AsyncSession,
    user_id: UUID,
    stock_id: UUID,
) -> bool:
    """Check if a user is tracking a stock"""
    result = await session.execute(
        select(UserStockTracking).where(
            and_(
                UserStockTracking.user_id == user_id,
                UserStockTracking.stock_id == stock_id,
            )
        )
    )
    return result.scalar_one_or_none() is not None


async def get_tracked_stocks(
    session: AsyncSession,
    user_id: UUID,
) -> list[Stock]:
    """Get all stocks tracked by a user"""
    result = await session.execute(
        select(Stock)
        .join(UserStockTracking, Stock.id == UserStockTracking.stock_id)
        .where(UserStockTracking.user_id == user_id)
    )
    return list(result.scalars().all())


async def get_tracked_stock_ids(
    session: AsyncSession,
    user_id: UUID,
) -> list[UUID]:
    """Get list of stock IDs tracked by a user"""
    result = await session.execute(
        select(UserStockTracking.stock_id).where(
            UserStockTracking.user_id == user_id
        )
    )
    return [row[0] for row in result.all()]


async def track_stock(
    session: AsyncSession,
    user_id: UUID,
    stock_id: UUID,
) -> UserStockTracking:
    """
    Track a stock for a user.
    
    Enforces tier limits (free tier: max 5 stocks).
    
    Raises:
        ValueError: If tier limit reached or stock already tracked
    """
    # Check if already tracked
    if await is_stock_tracked(session, user_id, stock_id):
        raise ValueError("Stock is already being tracked")
    
    # Check tier limit
    tier_check = await check_tier_limit(session, user_id)
    if not tier_check.get('allowed', False):
        reason = tier_check.get('reason', 'unknown')
        if reason == 'free_tier_limit_reached':
            raise ValueError(
                f"Free tier limit reached. You can track up to {tier_check.get('limit', 5)} stocks. "
                "Upgrade to premium for unlimited tracking."
            )
        else:
            raise ValueError("Cannot track stock at this time")
    
    # Verify stock exists
    from app.crud.stocks import get_stock_by_id
    stock = await get_stock_by_id(session, stock_id)
    if stock is None:
        raise ValueError("Stock not found")
    
    # Create tracking record
    tracking = UserStockTracking(
        user_id=user_id,
        stock_id=stock_id,
    )
    session.add(tracking)
    
    try:
        await session.commit()
        await session.refresh(tracking)
        logger.info(
            "Stock tracked successfully",
            extra={
                "user_id": str(user_id),
                "stock_id": str(stock_id),
            }
        )
        return tracking
    except IntegrityError:
        await session.rollback()
        # Check if it was added concurrently
        if await is_stock_tracked(session, user_id, stock_id):
            raise ValueError("Stock is already being tracked")
        raise ValueError("Failed to track stock")


async def untrack_stock(
    session: AsyncSession,
    user_id: UUID,
    stock_id: UUID,
) -> bool:
    """
    Untrack a stock for a user.
    
    Returns:
        True if stock was untracked, False if it wasn't being tracked
    """
    result = await session.execute(
        select(UserStockTracking).where(
            and_(
                UserStockTracking.user_id == user_id,
                UserStockTracking.stock_id == stock_id,
            )
        )
    )
    tracking = result.scalar_one_or_none()
    
    if tracking is None:
        return False
    
    await session.delete(tracking)
    await session.commit()
    
    logger.info(
        "Stock untracked successfully",
        extra={
            "user_id": str(user_id),
            "stock_id": str(stock_id),
        }
    )
    return True

