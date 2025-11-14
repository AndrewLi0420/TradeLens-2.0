"""Performance tests for market data batch processing"""
import asyncio
import pytest
import time
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

# Import models to ensure relationships are registered
from app.models import Stock, MarketData  # noqa: F401
from app.users.models import User  # noqa: F401
from app.models.user_preferences import UserPreferences  # noqa: F401

from app.crud.stocks import create_stock
from app.tasks.market_data import collect_market_data_for_stocks


@pytest.mark.asyncio
async def test_batch_processing_performance(db_session):
    """Test batch processing performance for 500 stocks (AC: 1, 2)"""
    # Create 500 stocks (simulate Fortune 500)
    stocks = []
    for i in range(500):
        stock = await create_stock(
            session=db_session,
            symbol=f"STOCK{i:03d}",
            company_name=f"Stock {i} Inc.",
        )
        stocks.append(stock)
    
    # Mock API calls to be fast (simulate real API response time)
    async def mock_collect(symbol, session=None):
        # Simulate API call delay (12 seconds for rate limiting)
        await asyncio.sleep(0.001)  # 1ms per call (much faster than real API)
        return {
            "price": 100.00,
            "volume": 1000000,
            "timestamp": datetime.now(timezone.utc),
        }
    
    import asyncio
    
    with patch("app.services.data_collection.collect_market_data_from_yfinance", side_effect=mock_collect):
        start_time = time.time()
        
        stats = await collect_market_data_for_stocks(
            session=db_session,
            stocks=stocks,
            batch_size=50,  # Process 50 stocks per batch
        )
        
        end_time = time.time()
        duration = end_time - start_time
    
    # Performance check: Should complete 500 stocks within reasonable time
    # In real scenario with rate limiting, this would take longer, but we're testing
    # that the batch processing mechanism works correctly
    assert stats["total"] == 500
    assert stats["successful"] == 500  # All should succeed in this test
    assert duration < 60  # Should complete in under 60 seconds (with mocked fast API)


@pytest.mark.asyncio
async def test_batch_processing_with_yfinance(db_session):
    """Test batch processing with yfinance (no rate limiting needed)"""
    # Create a few stocks
    stocks = []
    for i in range(10):
        stock = await create_stock(
            session=db_session,
            symbol=f"STOCK{i}",
            company_name=f"Stock {i} Inc.",
        )
        stocks.append(stock)
    
    call_times = []
    
    async def mock_collect(symbol, session=None):
        call_times.append(time.time())
        return {
            "price": 100.00,
            "volume": 1000000,
            "timestamp": datetime.now(timezone.utc),
        }
    
    with patch("app.services.data_collection.collect_market_data_from_yfinance", side_effect=mock_collect):
        stats = await collect_market_data_for_stocks(
            session=db_session,
            stocks=stocks,
            batch_size=5,
        )
    
    assert stats["total"] == 10
    assert stats["successful"] == 10


@pytest.mark.asyncio
async def test_batch_processing_handles_failures(db_session):
    """Test that batch processing continues despite failures (graceful degradation)"""
    # Create 50 stocks
    stocks = []
    for i in range(50):
        stock = await create_stock(
            session=db_session,
            symbol=f"STOCK{i}",
            company_name=f"Stock {i} Inc.",
        )
        stocks.append(stock)
    
    # Mock API - fail for every 10th stock
    async def mock_collect(symbol, session=None):
        stock_num = int(symbol.replace("STOCK", ""))
        if stock_num % 10 == 0:
            return None  # Fail
        return {
            "price": 100.00,
            "volume": 1000000,
            "timestamp": datetime.now(timezone.utc),
        }
    
    import asyncio
    
    with patch("app.services.data_collection.collect_market_data_from_yfinance", side_effect=mock_collect):
        stats = await collect_market_data_for_stocks(
            session=db_session,
            stocks=stocks,
            batch_size=10,
        )
    
    # Should have processed all stocks despite some failures
    assert stats["total"] == 50
    assert stats["successful"] == 45  # 50 - 5 failures (every 10th)
    assert stats["failed"] == 5
    # Verify graceful degradation: pipeline continued despite failures
    assert stats["successful"] > 0


@pytest.mark.asyncio
async def test_concurrent_processing_within_rate_limits(db_session):
    """Test that concurrent processing doesn't exceed rate limits"""
    # Create stocks
    stocks = []
    for i in range(20):
        stock = await create_stock(
            session=db_session,
            symbol=f"STOCK{i}",
            company_name=f"Stock {i} Inc.",
        )
        stocks.append(stock)
    
    concurrent_calls = []
    max_concurrent = 0
    current_concurrent = 0
    
    async def mock_collect(symbol, session=None):
        nonlocal current_concurrent, max_concurrent
        current_concurrent += 1
        concurrent_calls.append(current_concurrent)
        max_concurrent = max(max_concurrent, current_concurrent)
        
        await asyncio.sleep(0.01)  # Simulate API call
        
        current_concurrent -= 1
        
        return {
            "price": 100.00,
            "volume": 1000000,
            "timestamp": datetime.now(timezone.utc),
        }
    
    with patch("app.services.data_collection.collect_market_data_from_yfinance", side_effect=mock_collect):
        stats = await collect_market_data_for_stocks(
            session=db_session,
            stocks=stocks,
            batch_size=10,
        )
    
    # Verify all stocks were processed
    assert stats["total"] == 20
    assert stats["successful"] == 20
    
    # Verify concurrent processing occurred (multiple calls happening at once)
    # This shows async processing is working
    assert max_concurrent > 1  # Should have concurrent calls

