import pytest
import pytest_asyncio
from uuid import uuid4
from datetime import datetime
from httpx import AsyncClient, ASGITransport
from fastapi import FastAPI
from unittest.mock import patch, AsyncMock

from app.api.v1.endpoints.recommendations import router as rec_router
from app.db.config import get_db
from app.schemas.recommendation import RecommendationRead
from app.schemas.stock import StockRead
from app.users.models import User
from app.models.enums import TierEnum


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
async def test_get_recommendation_returns_correct_data(client):
    """Test GET /recommendations/{id} returns correct recommendation data"""
    user = User(id=uuid4(), tier=TierEnum.PREMIUM)
    rec_id = uuid4()
    stock_id = uuid4()

    stock = StockRead(
        id=stock_id,
        symbol="AAPL",
        company_name="Apple Inc.",
        sector="Technology",
        fortune_500_rank=1,
    )
    rec = RecommendationRead(
        id=rec_id,
        user_id=user.id,
        stock_id=stock_id,
        stock=stock,
        signal="buy",
        confidence_score=0.9,
        risk_level="low",
        explanation="Strong outlook based on positive sentiment",
        sentiment_score=0.12,
        created_at=datetime.utcnow(),
    )

    async def fake_current_user():
        return user

    async def fake_get_recommendation_by_id(session, user_id, recommendation_id):
        assert user_id == user.id
        assert recommendation_id == rec_id
        return rec

    with patch("app.api.v1.endpoints.recommendations.current_user", new=fake_current_user), \
         patch("app.api.v1.endpoints.recommendations.get_recommendation_by_id", side_effect=fake_get_recommendation_by_id):
        resp = await client.get(f"/api/v1/recommendations/{rec_id}")

    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(rec_id)
    assert data["stock"]["symbol"] == "AAPL"
    assert data["stock"]["company_name"] == "Apple Inc."
    assert data["stock"]["sector"] == "Technology"
    assert data["stock"]["fortune_500_rank"] == 1
    assert data["signal"] == "buy"
    assert data["confidence_score"] == 0.9
    assert data["explanation"] == "Strong outlook based on positive sentiment"


@pytest.mark.asyncio
async def test_get_recommendation_returns_404_if_not_found(client):
    """Test GET /recommendations/{id} returns 404 if recommendation not found"""
    user = User(id=uuid4(), tier=TierEnum.PREMIUM)
    rec_id = uuid4()

    async def fake_current_user():
        return user

    async def fake_get_recommendation_by_id(session, user_id, recommendation_id):
        return None

    # Mock the check query to return None (recommendation doesn't exist)
    async def fake_check_query():
        return None

    with patch("app.api.v1.endpoints.recommendations.current_user", new=fake_current_user), \
         patch("app.api.v1.endpoints.recommendations.get_recommendation_by_id", side_effect=fake_get_recommendation_by_id), \
         patch("app.api.v1.endpoints.recommendations.select") as mock_select:
        # Mock the check to return None (recommendation doesn't exist)
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session = AsyncMock()
        mock_session.execute.return_value = mock_result

        resp = await client.get(f"/api/v1/recommendations/{rec_id}")

    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_recommendation_free_tier_cannot_access_untracked_stock(client):
    """Test GET /recommendations/{id} returns 403 if free tier user tries to access untracked stock recommendation"""
    user = User(id=uuid4(), tier=TierEnum.FREE)
    rec_id = uuid4()

    async def fake_current_user():
        return user

    async def fake_get_recommendation_by_id(session, user_id, recommendation_id):
        # Returns None because free tier user doesn't have access
        return None

    # Mock the check query to return a recommendation (it exists but user doesn't have access)
    async def fake_check_query():
        return True

    with patch("app.api.v1.endpoints.recommendations.current_user", new=fake_current_user), \
         patch("app.api.v1.endpoints.recommendations.get_recommendation_by_id", side_effect=fake_get_recommendation_by_id):
        # Mock the existence check to return True (recommendation exists)
        with patch("app.api.v1.endpoints.recommendations.select") as mock_select:
            mock_result = AsyncMock()
            mock_result.scalar_one_or_none.return_value = AsyncMock()  # Recommendation exists
            mock_session = AsyncMock()
            mock_session.execute.return_value = mock_result

            resp = await client.get(f"/api/v1/recommendations/{rec_id}")

    assert resp.status_code == 403
    assert "access denied" in resp.json()["detail"].lower() or "tier" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_get_recommendation_premium_tier_can_access_any_recommendation(client):
    """Test GET /recommendations/{id} allows premium tier user to access any recommendation"""
    user = User(id=uuid4(), tier=TierEnum.PREMIUM)
    rec_id = uuid4()
    stock_id = uuid4()

    stock = StockRead(
        id=stock_id,
        symbol="AAPL",
        company_name="Apple Inc.",
    )
    rec = RecommendationRead(
        id=rec_id,
        user_id=user.id,
        stock_id=stock_id,
        stock=stock,
        signal="buy",
        confidence_score=0.9,
        risk_level="low",
        explanation=None,
        sentiment_score=0.12,
        created_at=datetime.utcnow(),
    )

    async def fake_current_user():
        return user

    async def fake_get_recommendation_by_id(session, user_id, recommendation_id):
        return rec

    with patch("app.api.v1.endpoints.recommendations.current_user", new=fake_current_user), \
         patch("app.api.v1.endpoints.recommendations.get_recommendation_by_id", side_effect=fake_get_recommendation_by_id):
        resp = await client.get(f"/api/v1/recommendations/{rec_id}")

    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(rec_id)


@pytest.mark.asyncio
async def test_get_recommendation_enforces_user_ownership(client):
    """Test GET /recommendations/{id} only returns recommendations belonging to the authenticated user"""
    user = User(id=uuid4(), tier=TierEnum.PREMIUM)
    other_user_id = uuid4()
    rec_id = uuid4()

    async def fake_current_user():
        return user

    async def fake_get_recommendation_by_id(session, user_id, recommendation_id):
        # Should only return recommendation if it belongs to the user
        assert user_id == user.id
        return None  # Recommendation doesn't belong to this user

    with patch("app.api.v1.endpoints.recommendations.current_user", new=fake_current_user), \
         patch("app.api.v1.endpoints.recommendations.get_recommendation_by_id", side_effect=fake_get_recommendation_by_id):
        with patch("app.api.v1.endpoints.recommendations.select") as mock_select:
            mock_result = AsyncMock()
            mock_result.scalar_one_or_none.return_value = None  # Recommendation doesn't exist for this user
            mock_session = AsyncMock()
            mock_session.execute.return_value = mock_result

            resp = await client.get(f"/api/v1/recommendations/{rec_id}")

    assert resp.status_code == 404


