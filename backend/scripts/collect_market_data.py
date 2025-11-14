#!/usr/bin/env python3
"""Script to collect market data only"""
import asyncio
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# Import all models to ensure SQLAlchemy can resolve relationships
# This must happen before importing any code that uses models
from app.users.models import User  # noqa: F401
from app.models import (  # noqa: F401
    UserPreferences,
    Stock,
    MarketData,
    SentimentData,
    Recommendation,
    UserStockTracking,
)

from app.tasks.market_data import collect_market_data_job


async def main():
    """Collect market data"""
    print("=" * 60)
    print("Market Data Collection Script")
    print("=" * 60)
    print("\nCollecting market data for all stocks...")
    print("This may take several minutes (processing 500 stocks)...")
    print("-" * 60)
    
    try:
        await collect_market_data_job()
        print("\n✓ Market data collection completed!")
    except Exception as e:
        print(f"\n✗ Market data collection failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

