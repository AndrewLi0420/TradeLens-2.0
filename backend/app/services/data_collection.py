"""Market data collection service for financial APIs"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

logger = logging.getLogger(__name__)


async def collect_market_data_from_yfinance(
    stock_symbol: str,
) -> dict[str, Any] | None:
    """
    Collect market data from yfinance for a single stock.
    
    Args:
        stock_symbol: Stock symbol (e.g., 'AAPL')
    
    Returns:
        dict with keys: price (float), volume (int), timestamp (datetime UTC)
        Returns None on failure
    
    Note:
        yfinance is synchronous, so we run it in a thread pool to avoid blocking.
    """
    try:
        import yfinance as yf
    except ImportError:
        logger.error("yfinance is not installed. Install with: pip install yfinance")
        return None
    
    try:
        # Normalize symbol for Yahoo Finance (e.g., BRK.B -> BRK-B)
        yahoo_symbol = stock_symbol.replace(".", "-")
        
        # Run yfinance in thread pool to avoid blocking async event loop
        # yfinance is synchronous, so we wrap both Ticker creation and history() call
        loop = asyncio.get_event_loop()
        
        def fetch_data():
            ticker = yf.Ticker(yahoo_symbol)
            # Fetch latest trading day data (1 day period)
            # Use auto_adjust=False to get raw prices
            return ticker.history(period="1d", interval="1d", auto_adjust=False)
        
        df = await loop.run_in_executor(None, fetch_data)
        
        if df is None or df.empty:
            logger.warning(f"No data returned from yfinance for {stock_symbol} ({yahoo_symbol})")
            return None
        
        # Get the most recent row (last row in DataFrame)
        latest_row = df.iloc[-1]
        
        # Extract price (Close) and volume
        price = float(latest_row.get("Close")) if latest_row.get("Close") is not None else None
        volume_val = latest_row.get("Volume")
        volume = int(volume_val) if volume_val is not None else None
        
        if price is None or volume is None:
            logger.warning(
                f"Missing price or volume in yfinance response for {stock_symbol} ({yahoo_symbol})"
            )
            return None
        
        # Validate numeric values
        if price <= 0 or volume < 0:
            logger.warning(
                f"Invalid price or volume for {stock_symbol} ({yahoo_symbol}): "
                f"price={price}, volume={volume}"
            )
            return None
        
        # Extract timestamp from DataFrame index (convert to naive UTC to match DB schema)
        timestamp_py = df.index[-1].to_pydatetime()
        # Convert to timezone-naive UTC
        if timestamp_py.tzinfo is not None:
            timestamp = timestamp_py.astimezone(timezone.utc).replace(tzinfo=None)
        else:
            timestamp = timestamp_py
        
        logger.debug(
            f"Successfully collected data from yfinance for {stock_symbol} ({yahoo_symbol}): "
            f"price={price}, volume={volume}, timestamp={timestamp}"
        )
        
        return {
            "price": price,
            "volume": volume,
            "timestamp": timestamp,
        }
        
    except Exception as e:
        logger.error(
            f"Error collecting data from yfinance for {stock_symbol}: {e}",
            exc_info=True,
        )
        return None


async def collect_market_data(
    stock_symbol: str,
    session: AsyncSession | None = None,
) -> dict[str, Any] | None:
    """
    Collect market data for a stock symbol.
    
    This is the main entry point for market data collection.
    Uses yfinance API (free, no API key required).
    
    Args:
        stock_symbol: Stock symbol (e.g., 'AAPL')
        session: Optional database session (not used currently but kept for interface compatibility)
    
    Returns:
        dict with keys: price (float), volume (int), timestamp (datetime UTC)
        Returns None on failure
    """
    return await collect_market_data_from_yfinance(stock_symbol)

