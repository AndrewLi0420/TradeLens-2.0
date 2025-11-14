"""Unit tests for recommendation explanation generation"""
import pytest
import pytest_asyncio
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.recommendation_service import (
    synthesize_explanation,
    validate_explanation_quality,
)
from app.models.enums import RiskLevelEnum
from app.models.sentiment_data import SentimentData
from app.models.market_data import MarketData


@pytest.mark.asyncio
async def test_synthesize_explanation_includes_all_required_elements():
    """Test that synthesized explanation includes sentiment, ML signals, and risk references"""
    session = AsyncMock()
    stock_id = uuid4()
    
    # Mock latest sentiment data
    latest_sentiment = MagicMock()
    latest_sentiment.timestamp = datetime.now(timezone.utc) - timedelta(minutes=5)
    latest_sentiment.source = "web_aggregate"
    
    # Mock latest market data
    latest_market = MagicMock()
    latest_market.timestamp = datetime.now(timezone.utc) - timedelta(hours=1)
    
    async def mock_get_latest_sentiment(session, stock_id, source=None):
        return latest_sentiment
    
    async def mock_get_latest_market(session, stock_id):
        return latest_market
    
    with patch("app.crud.sentiment_data.get_latest_sentiment_data", side_effect=mock_get_latest_sentiment), \
         patch("app.crud.market_data.get_latest_market_data", side_effect=mock_get_latest_market):
        explanation = await synthesize_explanation(
            session=session,
            stock_id=stock_id,
            signal="buy",
            confidence_score=0.85,
            sentiment_score=0.15,
            risk_level=RiskLevelEnum.LOW,
            ml_model_used="ensemble",
            ml_r_squared=0.82,
        )
    
    # Verify explanation includes required elements
    assert explanation is not None
    assert len(explanation) > 0
    
    explanation_lower = explanation.lower()
    
    # Check for sentiment references
    assert any(keyword in explanation_lower for keyword in ['sentiment', 'positive', 'negative', 'neutral', 'favorable'])
    
    # Check for ML signal references
    assert any(keyword in explanation_lower for keyword in ['model', 'confidence', 'buy', 'sell', 'hold'])
    
    # Check for risk references
    assert any(keyword in explanation_lower for keyword in ['risk', 'volatility', 'low', 'medium', 'high'])
    
    # Check for data sources
    assert 'data source' in explanation_lower or 'updated' in explanation_lower
    
    # Check for R² if provided
    assert '0.82' in explanation or 'r²' in explanation_lower or 'r-squared' in explanation_lower


@pytest.mark.asyncio
async def test_synthesize_explanation_without_r_squared():
    """Test explanation generation when R² is not available"""
    session = AsyncMock()
    stock_id = uuid4()
    
    latest_sentiment = MagicMock()
    latest_sentiment.timestamp = datetime.now(timezone.utc) - timedelta(minutes=10)
    latest_sentiment.source = "news"
    
    latest_market = MagicMock()
    latest_market.timestamp = datetime.now(timezone.utc) - timedelta(hours=2)
    
    async def mock_get_latest_sentiment(session, stock_id, source=None):
        return latest_sentiment
    
    async def mock_get_latest_market(session, stock_id):
        return latest_market
    
    with patch("app.crud.sentiment_data.get_latest_sentiment_data", side_effect=mock_get_latest_sentiment), \
         patch("app.crud.market_data.get_latest_market_data", side_effect=mock_get_latest_market):
        explanation = await synthesize_explanation(
            session=session,
            stock_id=stock_id,
            signal="hold",
            confidence_score=0.75,
            sentiment_score=-0.05,
            risk_level=RiskLevelEnum.MEDIUM,
            ml_model_used="neural_network",
            ml_r_squared=None,
        )
    
    assert explanation is not None
    assert 'confidence' in explanation.lower()
    # Should still work without R²


@pytest.mark.asyncio
async def test_synthesize_explanation_with_null_sentiment():
    """Test explanation generation when sentiment score is None"""
    session = AsyncMock()
    stock_id = uuid4()
    
    latest_market = MagicMock()
    latest_market.timestamp = datetime.now(timezone.utc) - timedelta(hours=1)
    
    async def mock_get_latest_sentiment(session, stock_id, source=None):
        return None  # No sentiment data
    
    async def mock_get_latest_market(session, stock_id):
        return latest_market
    
    with patch("app.crud.sentiment_data.get_latest_sentiment_data", side_effect=mock_get_latest_sentiment), \
         patch("app.crud.market_data.get_latest_market_data", side_effect=mock_get_latest_market):
        explanation = await synthesize_explanation(
            session=session,
            stock_id=stock_id,
            signal="sell",
            confidence_score=0.65,
            sentiment_score=None,
            risk_level=RiskLevelEnum.HIGH,
            ml_model_used="random_forest",
        )
    
    assert explanation is not None
    # Should handle null sentiment gracefully
    assert 'neutral' in explanation.lower() or 'limited' in explanation.lower()


def test_validate_explanation_quality_valid_explanation():
    """Test validation with a valid explanation"""
    explanation = (
        "Our ensemble model suggests potential price increase with 85% confidence "
        "based on analysis of recent market patterns and historical performance. "
        "Market analysis shows positive sentiment trends and low risk factors, "
        "indicating low volatility and market conditions. "
        "Data sources: Sentiment from Web Aggregate updated 5 min ago, Market data updated 1 hour ago."
    )
    
    result = validate_explanation_quality(explanation)
    
    assert result["is_valid"] is True
    assert result["has_sentiment_ref"] is True
    assert result["has_ml_signal_ref"] is True
    assert result["has_risk_ref"] is True
    assert result["has_data_sources"] is True
    assert 2 <= result["sentence_count"] <= 4
    assert 50 <= result["word_count"] <= 200


def test_validate_explanation_quality_too_short():
    """Test validation with an explanation that's too short"""
    explanation = "Buy signal with high confidence."
    
    result = validate_explanation_quality(explanation)
    
    assert result["is_valid"] is False or len(result["warnings"]) > 0
    assert any("too short" in w.lower() or "too few" in w.lower() for w in result["warnings"])


def test_validate_explanation_quality_missing_sentiment():
    """Test validation detects missing sentiment references"""
    explanation = (
        "Our model suggests buying with 85% confidence. "
        "Risk factors indicate low volatility. "
        "Data sources: Market data (updated 1 hour ago)."
    )
    
    result = validate_explanation_quality(explanation)
    
    assert "sentiment" in " ".join(result["warnings"]).lower()


def test_validate_explanation_quality_missing_risk():
    """Test validation detects missing risk references"""
    explanation = (
        "Our model suggests buying with 85% confidence. "
        "Market analysis shows positive sentiment trends. "
        "Data sources: Market data (updated 1 hour ago)."
    )
    
    result = validate_explanation_quality(explanation)
    
    assert "risk" in " ".join(result["warnings"]).lower()


def test_validate_explanation_quality_missing_data_sources():
    """Test validation detects missing data source attribution"""
    explanation = (
        "Our model suggests buying with 85% confidence. "
        "Market analysis shows positive sentiment trends and low risk factors."
    )
    
    result = validate_explanation_quality(explanation)
    
    assert "data source" in " ".join(result["warnings"]).lower() or "timestamp" in " ".join(result["warnings"]).lower()

