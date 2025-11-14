#!/usr/bin/env python3
"""Script to manually trigger sentiment collection"""
import asyncio
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# Import all models to ensure SQLAlchemy can resolve relationships
from app.users.models import User  # noqa: F401
from app.models import (  # noqa: F401
    UserPreferences,
    Stock,
    MarketData,
    SentimentData,
    Recommendation,
    UserStockTracking,
)

from app.tasks.sentiment import collect_sentiment_job


async def main():
    """Manually trigger sentiment collection"""
    print("=" * 60)
    print("Manual Sentiment Collection")
    print("=" * 60)
    print("\nStarting sentiment collection job...")
    print("This may take a few minutes depending on number of stocks...")
    print("-" * 60)
    
    try:
        await collect_sentiment_job()
        print("\n✓ Sentiment collection completed!")
        print("\nCheck the results with:")
        print("  python scripts/check_sentiment.py")
    except Exception as e:
        print(f"\n✗ Sentiment collection failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

