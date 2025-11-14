"""Stock search API endpoints"""
from __future__ import annotations

import logging
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.config import get_db
from app.core.auth import current_user
from app.users.models import User
from app.crud.stocks import search_stocks_with_recommendations, get_stock_by_id
from app.crud.recommendations import get_recommendations
from app.schemas.stock import StockSearch, StockRead

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/stocks", tags=["stocks"])


@router.get("/search", response_model=list[StockSearch], status_code=status.HTTP_200_OK)
async def search_stocks(
    q: str = Query(..., min_length=2, description="Search query (min 2 characters)"),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
) -> list[StockSearch]:
    """
    Search stocks by symbol or company name with recommendation status.
    
    - Requires authentication
    - Query parameter `q` must be at least 2 characters
    - Returns up to 50 matching stocks
    - Each result includes `has_recommendation` field indicating if user has a recommendation for that stock
    - Uses PostgreSQL ilike for case-insensitive partial matching
    """
    try:
        # Search stocks with recommendation status
        results = await search_stocks_with_recommendations(
            session=session,
            query=q,
            user_id=user.id,
            limit=50
        )
        
        # Convert to StockSearch schema
        stock_search_results = [
            StockSearch(
                id=stock.id,
                symbol=stock.symbol,
                company_name=stock.company_name,
                sector=stock.sector,
                fortune_500_rank=stock.fortune_500_rank,
                has_recommendation=has_recommendation
            )
            for stock, has_recommendation in results
        ]
        
        return stock_search_results
    except Exception as e:
        logger.error("Search stocks endpoint failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search stocks"
        )


@router.get("/{id}", response_model=StockSearch, status_code=status.HTTP_200_OK)
async def get_stock(
    id: UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_db),
) -> StockSearch:
    """
    Get a single stock by ID with recommendation status.
    
    - Requires authentication
    - Returns stock information with has_recommendation field
    - Returns 404 if stock not found
    """
    try:
        stock = await get_stock_by_id(session, id)
        
        if stock is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stock not found"
            )
        
        # Check if user has a recommendation for this stock
        user_recommendations = await get_recommendations(
            session=session,
            user_id=user.id,
        )
        has_recommendation = any(rec.stock_id == id for rec in user_recommendations)
        
        return StockSearch(
            id=stock.id,
            symbol=stock.symbol,
            company_name=stock.company_name,
            sector=stock.sector,
            fortune_500_rank=stock.fortune_500_rank,
            has_recommendation=has_recommendation,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Get stock endpoint failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve stock"
        )


