"""Recommendations API endpoints"""
from __future__ import annotations

import logging
from uuid import UUID
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.config import get_db
from app.core.auth import current_user
from app.users.models import User
from app.services.recommendation_service import generate_recommendations
from app.crud.recommendations import get_recommendations, get_recommendation_by_id
from app.schemas.recommendation import RecommendationRead

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/recommendations", tags=["recommendations"])


@router.get("", response_model=list[RecommendationRead], status_code=status.HTTP_200_OK)
async def list_recommendations(
    holding_period: Literal["daily", "weekly", "monthly"] | None = Query(None, description="Filter by holding period"),
    risk_level: Literal["low", "medium", "high"] | None = Query(None, description="Filter by risk level"),
    confidence_min: float | None = Query(None, ge=0.0, le=1.0, description="Minimum confidence score (0.0 to 1.0)"),
    sort_by: Literal["date", "confidence", "risk", "sentiment"] = Query("date", description="Sort field"),
    sort_direction: Literal["asc", "desc"] = Query("desc", description="Sort direction"),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
) -> list[RecommendationRead]:
    """
    Get recommendations for the current user with tier-aware filtering.
    
    - Free tier: Only returns recommendations for tracked stocks (max 5)
    - Premium tier: Returns all recommendations
    - Applies user preferences as default filters if query params not provided
    - Supports filtering by holding_period, risk_level, confidence_min
    - Supports sorting by date, confidence, risk, sentiment
    """
    try:
        recommendations = await get_recommendations(
            session=session,
            user_id=user.id,
            holding_period=holding_period,
            risk_level=risk_level,
            confidence_min=confidence_min,
            sort_by=sort_by,
            sort_direction=sort_direction,
        )
        return recommendations
    except Exception as e:
        logger.error("List recommendations endpoint failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve recommendations")


@router.get("/{id}", response_model=RecommendationRead, status_code=status.HTTP_200_OK)
async def get_recommendation(
    id: UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
) -> RecommendationRead:
    """
    Get a single recommendation by ID with tier-aware access control.
    
    - Free tier: Only returns recommendation if it's for a tracked stock (max 5)
    - Premium tier: Returns recommendation if it exists and belongs to user
    - Returns 404 if recommendation not found
    - Returns 403 if free tier user tries to access untracked stock recommendation
    """
    try:
        recommendation = await get_recommendation_by_id(
            session=session,
            user_id=user.id,
            recommendation_id=id,
        )
        
        if recommendation is None:
            # Check if recommendation exists but user doesn't have access
            # (e.g., free tier user trying to access untracked stock)
            from app.models.recommendation import Recommendation
            from sqlalchemy import select
            from sqlalchemy.orm import selectinload
            
            check_query = select(Recommendation).options(
                selectinload(Recommendation.stock)
            ).where(Recommendation.id == id)
            check_result = await session.execute(check_query)
            exists = check_result.scalar_one_or_none() is not None
            
            if exists:
                # Recommendation exists but user doesn't have access (tier restriction)
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: This recommendation is not available for your tier"
                )
            else:
                # Recommendation doesn't exist
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Recommendation not found"
                )
        
        return recommendation
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Get recommendation endpoint failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve recommendation")


@router.post("/generate", status_code=status.HTTP_202_ACCEPTED)
async def generate(
    user_id: UUID = Query(..., description="Target user UUID for generation"),
    count: int = Query(10, ge=1, le=100, description="Number of recommendations to generate"),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """
    Trigger recommendation generation on-demand.

    Returns minimal summary (count created). Intended for admin/internal use.
    """
    try:
        # Add diagnostic logging
        from app.crud.stocks import get_all_stocks, get_stocks_by_symbols
        from app.crud.market_data import get_market_data_count, get_stock_ids_with_market_data
        from app.core.config import settings
        
        # Universe-aware diagnostics
        universe = getattr(settings, "STOCK_UNIVERSE", []) or []
        if universe:
            stocks_universe = await get_stocks_by_symbols(session, universe)
            with_data = await get_stock_ids_with_market_data(session)
            eligible = [s for s in stocks_universe if s.id in with_data]
            logger.info(f"Generation request (universe): {len(eligible)}/{len(stocks_universe)} eligible stocks, target={count}")
            stocks = stocks_universe
        else:
            stocks = await get_all_stocks(session)
            logger.info(f"Generation request: {len(stocks)} stocks in database, target={count}")
        
        if not stocks:
            logger.warning("No stocks available for generation")
            return {"created": 0, "message": "No stocks in database. Please load Fortune 500 stocks first."}
        
        # Check market data availability
        market_data_count = await get_market_data_count(session)
        logger.info(f"Market data records: {market_data_count}")
        
        if market_data_count == 0:
            logger.warning("No market data available. ML predictions may fail.")
        
        recs = await generate_recommendations(
            session=session,
            user_id=user_id,
            daily_target_count=count,
            use_ensemble=True,
        )
        
        result = {"created": len(recs)}
        if len(recs) == 0:
            result["message"] = (
                "Generated 0 recommendations. Possible causes: "
                "no market data, ML models not loaded, all stocks filtered by preferences, "
                "or prediction failures. Check backend logs for details."
            )
            logger.warning(
                f"Generated 0 recommendations for user {user_id}. "
                f"Stocks: {len(stocks)}, Market data records: {market_data_count}"
            )
        
        return result
    except Exception as e:
        logger.error("Generation endpoint failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


