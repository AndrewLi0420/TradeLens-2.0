"""Integration tests for market data collection service and scheduled task"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timezone
import pandas as pd

# Import models to ensure relationships are registered
from app.models import Stock, MarketData  # noqa: F401
from app.users.models import User  # noqa: F401
from app.models.user_preferences import UserPreferences  # noqa: F401

from app.crud.stocks import create_stock, get_all_stocks
from app.crud.market_data import get_latest_market_data, get_market_data_count
from app.services.data_collection import collect_market_data
from app.tasks.market_data import collect_market_data_job, collect_market_data_for_stocks


@pytest.mark.asyncio
async def test_collect_market_data_success(db_session):
    """Test successful market data collection (AC: 1, 3)"""
    # Create a stock
    stock = await create_stock(
        session=db_session,
        symbol="AAPL",
        company_name="Apple Inc.",
    )
    
    # Mock yfinance DataFrame response
    mock_df = pd.DataFrame({
        "Close": [150.50],
        "Volume": [1000000],
    }, index=[pd.Timestamp.now()])
    
    with patch("app.services.data_collection.yf") as mock_yf:
        mock_ticker = MagicMock()
        mock_ticker.history.return_value = mock_df
        mock_yf.Ticker.return_value = mock_ticker
        
        # Mock executor to return the DataFrame
        with patch("app.services.data_collection.asyncio.get_event_loop") as mock_loop:
            mock_loop_instance = MagicMock()
            mock_loop_instance.run_in_executor = AsyncMock(return_value=mock_df)
            mock_loop.return_value = mock_loop_instance
            
            data = await collect_market_data(stock.symbol, db_session)
    
    assert data is not None
    assert data["price"] == 150.50
    assert data["volume"] == 1000000
    assert isinstance(data["timestamp"], datetime)


@pytest.mark.asyncio
async def test_collect_market_data_api_error(db_session):
    """Test API error handling (AC: 5)"""
    # Create a stock
    stock = await create_stock(
        session=db_session,
        symbol="INVALID",
        company_name="Invalid Stock",
    )
    
    # Mock empty DataFrame (yfinance returns empty for invalid symbols)
    mock_df = pd.DataFrame()
    
    with patch("app.services.data_collection.yf") as mock_yf:
        mock_ticker = MagicMock()
        mock_ticker.history.return_value = mock_df
        mock_yf.Ticker.return_value = mock_ticker
        
        # Mock executor to return empty DataFrame
        with patch("app.services.data_collection.asyncio.get_event_loop") as mock_loop:
            mock_loop_instance = MagicMock()
            mock_loop_instance.run_in_executor = AsyncMock(return_value=mock_df)
            mock_loop.return_value = mock_loop_instance
            
            data = await collect_market_data(stock.symbol, db_session)
        
    assert data is None  # Should return None on API error


@pytest.mark.asyncio
async def test_collect_market_data_batch_processing(db_session):
    """Test batch processing with graceful degradation (AC: 1, 5)"""
    # Create multiple stocks
    stocks = []
    for i in range(10):
        stock = await create_stock(
            session=db_session,
            symbol=f"STOCK{i}",
            company_name=f"Stock {i} Inc.",
        )
        stocks.append(stock)
    
    # Mock yfinance to return success for some, None for others
    def mock_collect_func(symbol, session=None):
        if "STOCK0" in symbol or "STOCK1" in symbol:
            return None  # Simulate failure
        return {
            "price": 100.00,
            "volume": 1000000,
            "timestamp": datetime.now(timezone.utc),
        }
    
    with patch("app.services.data_collection.collect_market_data_from_yfinance") as mock_collect:
        mock_collect.side_effect = mock_collect_func
        
        # Process in batches
        stats = await collect_market_data_for_stocks(
            session=db_session,
            stocks=stocks,
            batch_size=5,  # 2 batches of 5
        )
        
        # Should have processed successfully despite some failures
        assert stats["total"] == 10
        assert stats["successful"] == 8  # 10 - 2 failures
        assert stats["failed"] == 2  # 2 failures
        assert stats["successful"] + stats["failed"] == stats["total"]


@pytest.mark.asyncio
async def test_collect_market_data_job_execution(db_session):
    """Test APScheduler job execution (AC: 2)"""
    # Create test stocks
    stocks = []
    for i in range(5):
        stock = await create_stock(
            session=db_session,
            symbol=f"TEST{i}",
            company_name=f"Test Stock {i}",
        )
        stocks.append(stock)
    
    # Mock the collection function to return success
    async def mock_collect(symbol, session=None):
        return {
            "price": 100.00,
            "volume": 1000000,
            "timestamp": datetime.now(timezone.utc),
        }
    
    # Mock the database engine creation and session
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import sessionmaker
    from unittest.mock import MagicMock, AsyncMock
    
    mock_engine = AsyncMock()
    mock_engine.dispose = AsyncMock()  # Make dispose async
    
    # Create a context manager that returns db_session
    mock_session_context = AsyncMock()
    mock_session_context.__aenter__ = AsyncMock(return_value=db_session)
    mock_session_context.__aexit__ = AsyncMock(return_value=None)
    
    mock_sessionmaker = MagicMock(return_value=mock_session_context)
    
    # Patch the internal function directly since it's used by collect_market_data
    with patch("app.services.data_collection.collect_market_data_from_yfinance", side_effect=mock_collect):
        with patch("app.tasks.market_data.create_async_engine", return_value=mock_engine):
            with patch("app.tasks.market_data.sessionmaker", return_value=mock_sessionmaker):
                # Execute job
                await collect_market_data_job()
                
                # Verify data was collected
                count = await get_market_data_count(db_session)
                assert count == 5  # Should have collected data for all 5 stocks


@pytest.mark.asyncio
async def test_market_data_storage_with_timestamps(db_session):
    """Test that market data is stored with proper timestamps (AC: 4)"""
    # Create a stock
    stock = await create_stock(
        session=db_session,
        symbol="AAPL",
        company_name="Apple Inc.",
    )
    
    # Mock successful collection
    timestamp = datetime.now(timezone.utc)
    mock_data = {
        "price": 150.50,
        "volume": 1000000,
        "timestamp": timestamp,
    }
    
    with patch("app.services.data_collection.collect_market_data_from_yfinance", return_value=mock_data):
        from app.services.data_collection import collect_market_data
        from app.crud.market_data import create_market_data
        
        data = await collect_market_data(stock.symbol, db_session)
        assert data is not None
        
        # Store in database
        market_data = await create_market_data(
            session=db_session,
            stock_id=stock.id,
            price=data["price"],
            volume=data["volume"],
            timestamp=data["timestamp"],
        )
        
        # Verify storage
        assert market_data.stock_id == stock.id
        assert float(market_data.price) == 150.50
        assert market_data.volume == 1000000
        # Timestamp comparison (database may store naive datetime)
        stored_ts = market_data.timestamp.replace(tzinfo=timezone.utc) if market_data.timestamp.tzinfo is None else market_data.timestamp
        expected_ts = timestamp.replace(tzinfo=timezone.utc) if timestamp.tzinfo is None else timestamp
        assert abs((stored_ts - expected_ts).total_seconds()) < 1
        
        # Verify can retrieve
        latest = await get_latest_market_data(db_session, stock.id)
        assert latest is not None
