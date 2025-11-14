"""CRUD operations for stocks"""
from __future__ import annotations

from uuid import UUID, uuid4
from sqlalchemy import select, func, and_, case, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.stock import Stock


async def get_stock_by_symbol(
    session: AsyncSession, symbol: str
) -> Stock | None:
    """Get stock by symbol (case-insensitive)"""
    result = await session.execute(
        select(Stock).where(func.upper(Stock.symbol) == symbol.upper())
    )
    return result.scalar_one_or_none()


async def get_stock_by_name(
    session: AsyncSession, name: str
) -> Stock | None:
    """Get stock by exact company name match"""
    result = await session.execute(
        select(Stock).where(Stock.company_name == name)
    )
    return result.scalar_one_or_none()


async def search_stocks(
    session: AsyncSession, query: str, limit: int = 50
) -> list[Stock]:
    """Search stocks by symbol or company name (partial match)"""
    search_pattern = f"%{query}%"
    result = await session.execute(
        select(Stock)
        .where(
            (Stock.symbol.ilike(search_pattern))
            | (Stock.company_name.ilike(search_pattern))
        )
        .limit(limit)
    )
    return list(result.scalars().all())


async def search_stocks_with_recommendations(
    session: AsyncSession, query: str, user_id: UUID, limit: int = 50
) -> list[tuple[Stock, bool]]:
    """
    Search stocks by symbol or company name with fuzzy matching and relevance ordering.
    
    Uses PostgreSQL pg_trgm extension for fuzzy matching to handle typos.
    Results are ordered by relevance: exact matches first, then partial matches, then fuzzy matches.
    
    Returns list of tuples: (Stock, has_recommendation)
    """
    from app.models.recommendation import Recommendation
    
    query_upper = query.upper()
    query_lower = query.lower()
    search_pattern = f"%{query}%"
    
    # Calculate similarity scores for fuzzy matching (pg_trgm extension required)
    similarity_company = func.similarity(func.lower(Stock.company_name), query_lower)
    similarity_symbol = func.similarity(func.upper(Stock.symbol), query_upper)
    
    # Minimum similarity threshold for fuzzy matches (0.3 = 30% similarity)
    # This filters out completely unrelated results while allowing typos
    fuzzy_threshold = 0.3
    
    # Build search conditions: exact, partial, and fuzzy matches
    search_conditions = or_(
        # Exact matches (case-sensitive)
        Stock.symbol.ilike(query),
        Stock.company_name.ilike(query),
        # Case-insensitive exact matches
        func.upper(Stock.symbol) == query_upper,
        func.lower(Stock.company_name) == query_lower,
        # Partial matches with ilike
        Stock.symbol.ilike(search_pattern),
        Stock.company_name.ilike(search_pattern),
        # Fuzzy matches using similarity (handles typos)
        similarity_company >= fuzzy_threshold,
        similarity_symbol >= fuzzy_threshold,
    )
    
    # Relevance score: exact matches = 4, case-insensitive exact = 3, partial = 2, fuzzy = similarity score
    # Fuzzy matches use their similarity score (0.3-1.0) so higher similarity ranks higher
    relevance_score = (
        case(
            (Stock.symbol.ilike(query), 4.0),  # Exact symbol match (highest priority)
            (Stock.company_name.ilike(query), 4.0),  # Exact company name match (highest priority)
            (func.upper(Stock.symbol) == query_upper, 3.0),  # Case-insensitive exact symbol
            (func.lower(Stock.company_name) == query_lower, 3.0),  # Case-insensitive exact company
            (Stock.symbol.ilike(search_pattern), 2.0),  # Partial symbol match
            (Stock.company_name.ilike(search_pattern), 2.0),  # Partial company name match
            else_=func.greatest(similarity_company, similarity_symbol)  # Fuzzy match uses similarity score
        )
    )
    
    # Search stocks with relevance ordering
    stocks_result = await session.execute(
        select(Stock, relevance_score.label('relevance'))
        .where(search_conditions)
        .order_by(relevance_score.desc(), Stock.symbol.asc())
        .limit(limit)
    )
    
    # Extract stocks from results
    stocks = [row[0] for row in stocks_result.all()]
    
    if not stocks:
        return []
    
    # Get stock IDs
    stock_ids = [stock.id for stock in stocks]
    
    # Check which stocks have recommendations for this user
    recommendations_result = await session.execute(
        select(Recommendation.stock_id)
        .where(
            and_(
                Recommendation.user_id == user_id,
                Recommendation.stock_id.in_(stock_ids)
            )
        )
    )
    recommended_stock_ids = {row[0] for row in recommendations_result.all()}
    
    # Return stocks with recommendation status, maintaining relevance order
    return [(stock, stock.id in recommended_stock_ids) for stock in stocks]


async def get_all_stocks(
    session: AsyncSession
) -> list[Stock]:
    """Get all stocks"""
    result = await session.execute(select(Stock))
    return list(result.scalars().all())


async def get_stocks_by_symbols(
    session: AsyncSession,
    symbols: list[str],
) -> list[Stock]:
    """Get stocks filtered by a list of symbols (case-insensitive)."""
    if not symbols:
        return await get_all_stocks(session)
    upper = [s.upper() for s in symbols]
    result = await session.execute(
        select(Stock).where(func.upper(Stock.symbol).in_(upper))
    )
    return list(result.scalars().all())


async def get_stock_by_id(
    session: AsyncSession, stock_id: UUID
) -> Stock | None:
    """Get stock by ID"""
    result = await session.execute(
        select(Stock).where(Stock.id == stock_id)
    )
    return result.scalar_one_or_none()


async def get_stock_count(
    session: AsyncSession
) -> int:
    """Get total count of stocks"""
    result = await session.execute(select(func.count(Stock.id)))
    return result.scalar_one() or 0


async def create_stock(
    session: AsyncSession,
    symbol: str,
    company_name: str,
    sector: str | None = None,
    fortune_500_rank: int | None = None,
) -> Stock:
    """Create a new stock"""
    stock = Stock(
        id=uuid4(),
        symbol=symbol.upper(),
        company_name=company_name,
        sector=sector,
        fortune_500_rank=fortune_500_rank,
    )
    session.add(stock)
    await session.commit()
    await session.refresh(stock)
    return stock


async def upsert_stock(
    session: AsyncSession,
    symbol: str,
    company_name: str,
    sector: str | None = None,
    fortune_500_rank: int | None = None,
) -> Stock:
    """Create or update stock (idempotent import)"""
    # Try to get existing stock
    existing = await get_stock_by_symbol(session, symbol)
    
    if existing:
        # Update existing stock
        existing.company_name = company_name
        if sector is not None:
            existing.sector = sector
        if fortune_500_rank is not None:
            existing.fortune_500_rank = fortune_500_rank
        await session.commit()
        await session.refresh(existing)
        return existing
    else:
        # Create new stock
        return await create_stock(
            session, symbol, company_name, sector, fortune_500_rank
        )

