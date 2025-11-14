"""CRUD operations for recommendations"""
from __future__ import annotations

from uuid import UUID
from typing import Literal
from sqlalchemy import select, and_, or_, func, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.recommendation import Recommendation
from app.models.user_stock_tracking import UserStockTracking
from app.models.enums import RiskLevelEnum, TierEnum
from app.models.stock import Stock
from app.crud.users import get_user_preferences
from app.services.tier_service import get_user_tier


async def get_recommendations(
    session: AsyncSession,
    user_id: UUID,
    holding_period: Literal["daily", "weekly", "monthly"] | None = None,
    risk_level: Literal["low", "medium", "high"] | None = None,
    confidence_min: float | None = None,
    sort_by: Literal["date", "confidence", "risk", "sentiment"] = "date",
    sort_direction: Literal["asc", "desc"] = "desc",
) -> list[Recommendation]:
    """
    Get recommendations for a user with tier-aware filtering and query params.
    
    For free tier users: Only returns recommendations for tracked stocks (max 5).
    For premium tier users: Returns all recommendations.
    
    Applies user preferences as defaults if query params not provided.
    """
    # Start with base query, eager load stock relationship
    query = select(Recommendation).options(
        selectinload(Recommendation.stock)
    ).where(Recommendation.user_id == user_id)
    
    # Tier-aware filtering: Free tier users only see tracked stocks
    user_tier = await get_user_tier(session, user_id)
    if user_tier == TierEnum.FREE:
        # Get tracked stock IDs for free tier user
        tracked_stocks_query = select(UserStockTracking.stock_id).where(
            UserStockTracking.user_id == user_id
        )
        tracked_stocks_result = await session.execute(tracked_stocks_query)
        tracked_stock_ids = [row[0] for row in tracked_stocks_result.all()]
        
        if not tracked_stock_ids:
            # User has no tracked stocks, return empty list
            return []
        
        # Filter recommendations to only tracked stocks
        query = query.where(Recommendation.stock_id.in_(tracked_stock_ids))
    
    # Apply user preferences as defaults if query params not provided
    if holding_period is None or risk_level is None:
        user_prefs = await get_user_preferences(session, user_id)
        if user_prefs:
            if holding_period is None:
                # Map HoldingPeriodEnum to string
                holding_period = user_prefs.holding_period.value if user_prefs.holding_period else None
            if risk_level is None:
                # RiskToleranceEnum values already match risk_level strings ("low", "medium", "high")
                risk_level = user_prefs.risk_tolerance.value if user_prefs.risk_tolerance else None
    
    # Apply filters
    if holding_period:
        # Filter by holding period using risk_level as a proxy for volatility
        # This aligns with the generation logic where:
        # - Daily holding period prefers higher volatility (high risk)
        # - Weekly holding period prefers moderate volatility (medium risk)
        # - Monthly holding period prefers lower volatility (low risk)
        if holding_period == "daily":
            # Daily traders prefer higher volatility stocks (high risk)
            query = query.where(Recommendation.risk_level == RiskLevelEnum.HIGH)
        elif holding_period == "weekly":
            # Weekly traders prefer moderate volatility stocks (medium risk)
            query = query.where(Recommendation.risk_level == RiskLevelEnum.MEDIUM)
        elif holding_period == "monthly":
            # Monthly traders prefer lower volatility stocks (low risk)
            query = query.where(Recommendation.risk_level == RiskLevelEnum.LOW)
    
    if risk_level:
        risk_enum = RiskLevelEnum[risk_level.upper()]
        query = query.where(Recommendation.risk_level == risk_enum)
    
    if confidence_min is not None:
        query = query.where(Recommendation.confidence_score >= confidence_min)
    
    # Apply sorting
    if sort_by == "date":
        order_by = desc(Recommendation.created_at) if sort_direction == "desc" else asc(Recommendation.created_at)
    elif sort_by == "confidence":
        order_by = desc(Recommendation.confidence_score) if sort_direction == "desc" else asc(Recommendation.confidence_score)
    elif sort_by == "risk":
        # Risk enum order: LOW < MEDIUM < HIGH
        # Use CASE statement for proper ordering
        risk_case = func.case(
            (Recommendation.risk_level == RiskLevelEnum.LOW, 1),
            (Recommendation.risk_level == RiskLevelEnum.MEDIUM, 2),
            (Recommendation.risk_level == RiskLevelEnum.HIGH, 3),
            else_=4
        )
        if sort_direction == "desc":
            order_by = desc(risk_case)
        else:
            order_by = asc(risk_case)
    elif sort_by == "sentiment":
        # Handle NULL sentiment_score values (put them last)
        # Use nullslast() or nullsfirst() methods
        if sort_direction == "desc":
            order_by = desc(Recommendation.sentiment_score).nullslast()
        else:
            order_by = asc(Recommendation.sentiment_score).nullslast()
    else:
        # Default to date desc
        order_by = desc(Recommendation.created_at)
    
    query = query.order_by(order_by)
    
    # Execute query
    result = await session.execute(query)
    return list(result.scalars().all())


async def get_recommendation_by_id(
    session: AsyncSession,
    user_id: UUID,
    recommendation_id: UUID,
) -> Recommendation | None:
    """
    Get a single recommendation by ID with tier-aware access control.
    
    For free tier users: Only returns recommendation if it's for a tracked stock.
    For premium tier users: Returns recommendation if it exists and belongs to user.
    
    Returns:
        Recommendation object if found and accessible, None otherwise
    """
    # Start with base query, eager load stock relationship
    query = select(Recommendation).options(
        selectinload(Recommendation.stock)
    ).where(
        and_(
            Recommendation.id == recommendation_id,
            Recommendation.user_id == user_id
        )
    )
    
    # Execute query to get recommendation
    result = await session.execute(query)
    recommendation = result.scalar_one_or_none()
    
    if recommendation is None:
        # Recommendation not found or doesn't belong to user
        return None
    
    # Tier-aware access control: Free tier users only see tracked stocks
    user_tier = await get_user_tier(session, user_id)
    if user_tier == TierEnum.FREE:
        # Check if the recommendation's stock is tracked by the user
        tracked_stock_query = select(UserStockTracking.stock_id).where(
            and_(
                UserStockTracking.user_id == user_id,
                UserStockTracking.stock_id == recommendation.stock_id
            )
        )
        tracked_stock_result = await session.execute(tracked_stock_query)
        is_tracked = tracked_stock_result.scalar_one_or_none() is not None
        
        if not is_tracked:
            # Free tier user trying to access untracked stock recommendation
            return None
    
    # Premium tier or free tier with tracked stock: return recommendation
    return recommendation

