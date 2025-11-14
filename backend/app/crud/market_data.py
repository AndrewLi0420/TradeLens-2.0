"""CRUD operations for market data"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.market_data import MarketData


async def create_market_data(
    session: AsyncSession,
    stock_id: UUID,
    price: float,
    volume: int,
    timestamp: datetime,
) -> MarketData:
    """
    Create a new market data record.
    
    Args:
        session: Database session
        stock_id: UUID of the stock
        price: Stock price (DECIMAL)
        volume: Trading volume (BIGINT)
        timestamp: Timestamp for the market data
    
    Returns:
        Created MarketData instance
    """
    market_data = MarketData(
        id=uuid4(),
        stock_id=stock_id,
        price=price,
        volume=volume,
        timestamp=timestamp,
    )
    session.add(market_data)
    await session.commit()
    await session.refresh(market_data)
    return market_data


async def get_latest_market_data(
    session: AsyncSession,
    stock_id: UUID,
) -> MarketData | None:
    """
    Get the most recent market data for a stock.
    
    Args:
        session: Database session
        stock_id: UUID of the stock
    
    Returns:
        Latest MarketData instance or None if not found
    """
    result = await session.execute(
        select(MarketData)
        .where(MarketData.stock_id == stock_id)
        .order_by(MarketData.timestamp.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


def _to_naive_utc(dt: datetime) -> datetime:
    """Convert a datetime to timezone-naive UTC for DB comparisons."""
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


async def get_market_data_history(
    session: AsyncSession,
    stock_id: UUID,
    start_date: datetime,
    end_date: datetime,
) -> list[MarketData]:
    """
    Get historical market data for a stock within a date range.
    
    Args:
        session: Database session
        stock_id: UUID of the stock
        start_date: Start of date range (inclusive)
        end_date: End of date range (inclusive)
    
    Returns:
        List of MarketData instances ordered by timestamp (ascending)
    """
    # Normalize to timezone-naive UTC to match TIMESTAMP WITHOUT TIME ZONE
    start_naive = _to_naive_utc(start_date)
    end_naive = _to_naive_utc(end_date)

    result = await session.execute(
        select(MarketData)
        .where(
            and_(
                MarketData.stock_id == stock_id,
                MarketData.timestamp >= start_naive,
                MarketData.timestamp <= end_naive,
            )
        )
        .order_by(MarketData.timestamp.asc())
    )
    return list(result.scalars().all())


async def get_market_data_count(
    session: AsyncSession,
    stock_id: UUID | None = None,
) -> int:
    """
    Get total count of market data records.
    
    Args:
        session: Database session
        stock_id: Optional stock ID to filter by
    
    Returns:
        Total count of market data records
    """
    query = select(func.count(MarketData.id))
    if stock_id is not None:
        query = query.where(MarketData.stock_id == stock_id)
    
    result = await session.execute(query)
    return result.scalar_one() or 0


async def get_stock_ids_with_market_data(
    session: AsyncSession,
) -> set[UUID]:
    """
    Get set of stock IDs that have at least one market data row.
    """
    result = await session.execute(
        select(MarketData.stock_id).distinct()
    )
    return {row[0] for row in result.all()}

async def get_stocks_with_stale_data(
    session: AsyncSession,
    max_age_hours: int = 1,
) -> list[tuple[UUID, datetime | None]]:
    """
    Get stocks with stale market data (not updated recently).
    
    This function helps track data freshness (AC 7) by identifying stocks
    that haven't been updated within the specified time window.
    
    Args:
        session: Database session
        max_age_hours: Maximum age in hours for data to be considered fresh
    
    Returns:
        List of tuples: (stock_id, last_update_timestamp | None)
        Returns None for last_update if no market data exists for that stock
    """
    from datetime import timedelta
    from app.models.stock import Stock
    
    # Use timezone-naive UTC for comparison with TIMESTAMP WITHOUT TIME ZONE
    from datetime import datetime as _dt
    cutoff_time = _dt.utcnow() - timedelta(hours=max_age_hours)
    
    # Query all stocks and their latest market data timestamps
    # Using LEFT JOIN to include stocks with no market data
    result = await session.execute(
        select(
            Stock.id,
            func.max(MarketData.timestamp).label("last_update")
        )
        .outerjoin(MarketData, Stock.id == MarketData.stock_id)
        .group_by(Stock.id)
        .having(
            (func.max(MarketData.timestamp) < cutoff_time)
            | (func.max(MarketData.timestamp).is_(None))
        )
    )
    
    return [(row.id, row.last_update) for row in result.all()]

