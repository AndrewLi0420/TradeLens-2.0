import pytest
import pytest_asyncio
from uuid import uuid4
from httpx import AsyncClient, ASGITransport
from fastapi import FastAPI
from unittest.mock import patch, AsyncMock

from app.api.v1.endpoints.search import router as search_router
from app.db.config import get_db
from app.core.auth import current_user
from app.schemas.stock import StockSearch
from app.users.models import User
from app.models.stock import Stock


@pytest_asyncio.fixture
async def client(db_session):
    app = FastAPI()

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    app.include_router(search_router)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as ac:
        yield ac, app
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_search_stocks_returns_results(client):
    client, app = client
    user = User(id=uuid4())

    # Mock stock search results
    stock1 = Stock(
        id=uuid4(),
        symbol="AAPL",
        company_name="Apple Inc.",
        sector="Technology",
        fortune_500_rank=1
    )
    stock2 = Stock(
        id=uuid4(),
        symbol="MSFT",
        company_name="Microsoft Corporation",
        sector="Technology",
        fortune_500_rank=2
    )

    async def fake_current_user():
        return user

    async def fake_search_stocks_with_recommendations(session, query, user_id, limit):
        # Return stocks with recommendation status
        return [
            (stock1, True),  # Has recommendation
            (stock2, False),  # No recommendation
        ]

    app.dependency_overrides[current_user] = fake_current_user
    try:
        with patch('app.api.v1.endpoints.search.search_stocks_with_recommendations', fake_search_stocks_with_recommendations):
            response = await client.get("/api/v1/stocks/search?q=app")
    finally:
        app.dependency_overrides.pop(current_user, None)

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 2
    assert data[0]["symbol"] == "AAPL"
    assert data[0]["has_recommendation"] is True
    assert data[1]["symbol"] == "MSFT"
    assert data[1]["has_recommendation"] is False


@pytest.mark.asyncio
async def test_search_stocks_requires_authentication(client):
    client, app = client

    async def fake_current_user():
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Not authenticated")

    app.dependency_overrides[current_user] = fake_current_user
    try:
        response = await client.get("/api/v1/stocks/search?q=app")
    finally:
        app.dependency_overrides.pop(current_user, None)

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_search_stocks_validates_query_length(client):
    client, app = client
    user = User(id=uuid4())

    async def fake_current_user():
        return user

    app.dependency_overrides[current_user] = fake_current_user
    try:
        # Query too short (1 character)
        response = await client.get("/api/v1/stocks/search?q=a")
        assert response.status_code == 422  # Validation error

        # Query missing
        response = await client.get("/api/v1/stocks/search")
        assert response.status_code == 422  # Validation error
    finally:
        app.dependency_overrides.pop(current_user, None)


@pytest.mark.asyncio
async def test_search_stocks_handles_empty_results(client):
    client, app = client
    user = User(id=uuid4())

    async def fake_current_user():
        return user

    async def fake_search_stocks_with_recommendations(session, query, user_id, limit):
        return []

    app.dependency_overrides[current_user] = fake_current_user
    try:
        with patch('app.api.v1.endpoints.search.search_stocks_with_recommendations', fake_search_stocks_with_recommendations):
            response = await client.get("/api/v1/stocks/search?q=xyz")
    finally:
        app.dependency_overrides.pop(current_user, None)

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 0


