"""Models package for database schema"""
from app.models.user_preferences import UserPreferences
from app.models.stock import Stock
from app.models.market_data import MarketData
from app.models.sentiment_data import SentimentData
from app.models.recommendation import Recommendation
from app.models.user_stock_tracking import UserStockTracking

# Note: User is NOT imported here to avoid circular import
# User imports from app.models.enums, which triggers this __init__.py
# Import User directly from app.users.models where needed:
#   from app.users.models import User

__all__ = [
    "UserPreferences",
    "Stock",
    "MarketData",
    "SentimentData",
    "Recommendation",
    "UserStockTracking",
]
