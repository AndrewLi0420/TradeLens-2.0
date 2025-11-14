import pytest
import pytest_asyncio
from uuid import uuid4
from datetime import datetime
from httpx import AsyncClient, ASGITransport
from fastapi import FastAPI
from unittest.mock import patch

from app.api.v1.endpoints.recommendations import router as rec_router
from app.db.config import get_db
from app.schemas.recommendation import RecommendationRead
from app.schemas.stock import StockRead
from app.users.models import User


@pytest_asyncio.fixture
async def client(db_session):
    app = FastAPI()

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    app.include_router(rec_router)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as ac:
        yield ac
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_list_recommendations_maps_query_params_and_returns_data(client):
    user = User(id=uuid4())  # minimal user stub

    # Fake data returned by CRUD layer
    stock = StockRead(id=uuid4(), symbol="AAPL", company_name="Apple Inc.")
    rec = RecommendationRead(
        id=uuid4(),
        user_id=user.id,
        stock_id=stock.id,
        stock=stock,
        signal="buy",
        confidence_score=0.9,
        risk_level="low",
        explanation="Test explanation with sentiment, ML signals, and risk factors. Data sources: Market data (updated 1 hour ago).",
        sentiment_score=0.12,
        created_at=datetime.utcnow(),
    )

    async def fake_current_user():
        return user

    async def fake_get_recommendations(session, user_id, holding_period, risk_level, confidence_min, sort_by, sort_direction):
        # Validate that parameters are passed through
        assert holding_period == "weekly"
        assert risk_level == "medium"
        assert abs(confidence_min - 0.7) < 1e-6
        assert sort_by == "confidence"
        assert sort_direction == "asc"
        return [rec]

    with patch("app.api.v1.endpoints.recommendations.current_user", new=fake_current_user), \
         patch("app.api.v1.endpoints.recommendations.get_recommendations", side_effect=fake_get_recommendations):
        resp = await client.get(
            "/api/v1/recommendations",
            params=dict(holding_period="weekly", risk_level="medium", confidence_min=0.7, sort_by="confidence", sort_direction="asc"),
        )

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list) and len(data) == 1
    item = data[0]
    assert item["stock"]["symbol"] == "AAPL"
    assert item["signal"] == "buy"
    # Verify explanation field is present in response
    assert "explanation" in item
    assert item["explanation"] is not None
    assert len(item["explanation"]) > 0



