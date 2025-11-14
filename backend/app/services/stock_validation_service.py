"""Stock validation service"""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.stock import Stock
from app.crud.stocks import get_stock_count

logger = logging.getLogger(__name__)


async def validate_stock_completeness(
    session: AsyncSession, expected_count: int = 500
) -> dict[str, Any]:
    """
    Validate that at least the expected number of stocks exist (greater than expected_count).
    
    Returns validation result dict with:
    - valid: bool
    - actual_count: int
    - expected_count: int
    - message: str
    """
    actual_count = await get_stock_count(session)
    
    is_valid = actual_count > expected_count
    
    result = {
        "valid": is_valid,
        "actual_count": actual_count,
        "expected_count": expected_count,
        "message": (
            f"Stock count validation: {actual_count} stocks found, "
            f"expected more than {expected_count}"
        ),
    }
    
    if not is_valid:
        logger.warning(result["message"])
    else:
        logger.info(result["message"])
    
    return result


async def validate_required_fields(
    session: AsyncSession
) -> dict[str, Any]:
    """
    Validate that all stocks have required fields (symbol, company_name).
    
    Returns validation result dict with:
    - valid: bool
    - invalid_stocks: list of stock symbols with missing fields
    - message: str
    """
    result = await session.execute(
        select(Stock).where(
            (Stock.symbol.is_(None))
            | (Stock.company_name.is_(None))
            | (Stock.symbol == "")
            | (Stock.company_name == "")
        )
    )
    invalid_stocks = list(result.scalars().all())
    
    is_valid = len(invalid_stocks) == 0
    
    validation_result = {
        "valid": is_valid,
        "invalid_stocks": [
            {"symbol": s.symbol, "company_name": s.company_name}
            for s in invalid_stocks
        ],
        "message": (
            f"Required fields validation: {len(invalid_stocks)} stocks "
            f"with missing required fields"
            if invalid_stocks
            else "All stocks have required fields"
        ),
    }
    
    if not is_valid:
        logger.warning(validation_result["message"])
    else:
        logger.info(validation_result["message"])
    
    return validation_result


async def validate_data_types(
    session: AsyncSession
) -> dict[str, Any]:
    """
    Validate data types:
    - symbol is string
    - fortune_500_rank is integer (if not null)
    - sector is string (if not null)
    
    Returns validation result dict with:
    - valid: bool
    - invalid_stocks: list of stocks with type issues
    - message: str
    """
    # Get all stocks to check types
    result = await session.execute(select(Stock))
    all_stocks = list(result.scalars().all())
    
    invalid_stocks = []
    
    for stock in all_stocks:
        issues = []
        
        # Check symbol is string (should always be, but verify)
        if not isinstance(stock.symbol, str):
            issues.append("symbol not string")
        
        # Check fortune_500_rank is integer if not None
        if stock.fortune_500_rank is not None and not isinstance(
            stock.fortune_500_rank, int
        ):
            issues.append("fortune_500_rank not integer")
        
        # Check sector is string if not None
        if stock.sector is not None and not isinstance(stock.sector, str):
            issues.append("sector not string")
        
        if issues:
            invalid_stocks.append({"symbol": stock.symbol, "issues": issues})
    
    is_valid = len(invalid_stocks) == 0
    
    validation_result = {
        "valid": is_valid,
        "invalid_stocks": invalid_stocks,
        "message": (
            f"Data types validation: {len(invalid_stocks)} stocks "
            f"with type issues"
            if invalid_stocks
            else "All stocks have correct data types"
        ),
    }
    
    if not is_valid:
        logger.warning(validation_result["message"])
    else:
        logger.info(validation_result["message"])
    
    return validation_result


async def validate_symbol_format(
    session: AsyncSession
) -> dict[str, Any]:
    """
    Validate symbol format:
    - Symbols are uppercase
    - Symbols are 1-6 characters (handles cases like BRK.A and common 5-6 char tickers)
    
    Returns validation result dict with:
    - valid: bool
    - invalid_stocks: list of stocks with invalid symbol formats
    - message: str
    """
    result = await session.execute(select(Stock))
    all_stocks = list(result.scalars().all())
    
    invalid_stocks = []
    
    for stock in all_stocks:
        if not stock.symbol:
            invalid_stocks.append(
                {"symbol": stock.symbol, "issue": "empty symbol"}
            )
            continue
        
        # Check length (1-6 characters, accounting for dot notation like BRK.A)
        if len(stock.symbol) < 1 or len(stock.symbol) > 6:
            invalid_stocks.append(
                {
                    "symbol": stock.symbol,
                    "issue": f"symbol length {len(stock.symbol)} not in range 1-5",
                }
            )
            continue
        
        # Check is uppercase (symbols should be uppercase)
        if stock.symbol != stock.symbol.upper():
            invalid_stocks.append(
                {"symbol": stock.symbol, "issue": "symbol not uppercase"}
            )
    
    is_valid = len(invalid_stocks) == 0
    
    validation_result = {
        "valid": is_valid,
        "invalid_stocks": invalid_stocks,
        "message": (
            f"Symbol format validation: {len(invalid_stocks)} stocks "
            f"with invalid symbol formats"
            if invalid_stocks
            else "All stock symbols have valid format"
        ),
    }
    
    if not is_valid:
        logger.warning(validation_result["message"])
    else:
        logger.info(validation_result["message"])
    
    return validation_result


async def validate_all(
    session: AsyncSession, expected_count: int = 500
) -> dict[str, Any]:
    """
    Run all validation checks.
    
    Returns comprehensive validation result with all checks.
    """
    results = {
        "completeness": await validate_stock_completeness(
            session, expected_count
        ),
        "required_fields": await validate_required_fields(session),
        "data_types": await validate_data_types(session),
        "symbol_format": await validate_symbol_format(session),
    }
    
    overall_valid = all(r["valid"] for r in results.values())
    
    return {
        "valid": overall_valid,
        "checks": results,
        "message": (
            "All validations passed"
            if overall_valid
            else "Some validations failed - see checks for details"
        ),
    }

