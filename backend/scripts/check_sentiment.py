#!/usr/bin/env python3
"""Script to check if sentiment analysis is working"""
import asyncio
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone

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

from app.db.config import async_session_maker
from app.crud.sentiment_data import (
    get_aggregated_sentiment,
    get_sentiment_data_history,
    get_latest_sentiment_data,
)
from app.crud.stocks import get_all_stocks
from sqlalchemy import func, select
from app.models.sentiment_data import SentimentData
from app.models.stock import Stock


async def check_sentiment_status():
    """Check sentiment analysis status and display statistics"""
    print("=" * 60)
    print("Sentiment Analysis Status Check")
    print("=" * 60)
    
    async with async_session_maker() as session:
        # 1. Check total sentiment records
        result = await session.execute(select(func.count(SentimentData.id)))
        total_records = result.scalar_one() or 0
        print(f"\n[1] Total Sentiment Records: {total_records}")
        
        if total_records == 0:
            print("⚠️  No sentiment data found in database!")
            print("   - Check if sentiment collection job is running")
            print("   - Check application logs for errors")
            print("   - Verify stocks are loaded in database")
            return
        
        # 2. Check records by source
        result = await session.execute(
            select(SentimentData.source, func.count(SentimentData.id))
            .group_by(SentimentData.source)
        )
        source_counts = result.all()
        print(f"\n[2] Records by Source:")
        for source, count in source_counts:
            print(f"   - {source}: {count} records")
        
        # 3. Check most recent sentiment data
        result = await session.execute(
            select(SentimentData)
            .order_by(SentimentData.timestamp.desc())
            .limit(10)
        )
        recent = result.scalars().all()
        print(f"\n[3] Most Recent Sentiment Data (last 10):")
        for record in recent:
            stock_result = await session.execute(
                select(Stock).where(Stock.id == record.stock_id)
            )
            stock = stock_result.scalar_one_or_none()
            symbol = stock.symbol if stock else "Unknown"
            print(f"   - {symbol}: {float(record.sentiment_score):.3f} "
                  f"(source: {record.source}, time: {record.timestamp})")
        
        # 4. Check aggregated sentiment for a few stocks
        stocks = await get_all_stocks(session)
        if stocks:
            print(f"\n[4] Aggregated Sentiment for Sample Stocks:")
            sample_stocks = stocks[:5]  # Check first 5 stocks
            for stock in sample_stocks:
                aggregated = await get_aggregated_sentiment(session, stock.id)
                latest = await get_latest_sentiment_data(session, stock.id, source="web_aggregate")
                if aggregated is not None:
                    print(f"   - {stock.symbol}: {aggregated:.3f} "
                          f"(latest: {latest.timestamp if latest else 'N/A'})")
                else:
                    print(f"   - {stock.symbol}: No sentiment data")
        
        # 5. Check sentiment data freshness
        # Convert to naive UTC for database comparison (database uses TIMESTAMP WITHOUT TIME ZONE)
        one_hour_ago_aware = datetime.now(timezone.utc) - timedelta(hours=1)
        one_hour_ago = one_hour_ago_aware.replace(tzinfo=None)
        result = await session.execute(
            select(func.count(SentimentData.id))
            .where(SentimentData.timestamp >= one_hour_ago)
        )
        recent_count = result.scalar_one() or 0
        print(f"\n[5] Data Freshness:")
        print(f"   - Records in last hour: {recent_count}")
        if recent_count == 0:
            print("   ⚠️  No recent sentiment data - job may not be running")
        else:
            print("   ✓ Sentiment collection appears to be working")
        
        # 6. Check sentiment score distribution
        result = await session.execute(
            select(
                func.min(SentimentData.sentiment_score).label("min"),
                func.max(SentimentData.sentiment_score).label("max"),
                func.avg(SentimentData.sentiment_score).label("avg"),
            )
        )
        stats = result.one()
        print(f"\n[6] Sentiment Score Statistics:")
        print(f"   - Min: {float(stats.min):.3f}")
        print(f"   - Max: {float(stats.max):.3f}")
        print(f"   - Average: {float(stats.avg):.3f}")
        
        # 7. Check if sentiment is being used in recommendations
        try:
            from app.models.recommendation import Recommendation
            # Check if sentiment_score column exists by trying to query it
            result = await session.execute(
                select(func.count(Recommendation.id))
                .where(Recommendation.sentiment_score.isnot(None))
            )
            recs_with_sentiment = result.scalar_one() or 0
            result = await session.execute(select(func.count(Recommendation.id)))
            total_recs = result.scalar_one() or 0
            print(f"\n[7] Recommendations Using Sentiment:")
            print(f"   - Recommendations with sentiment: {recs_with_sentiment}/{total_recs}")
            if total_recs > 0:
                percentage = (recs_with_sentiment / total_recs) * 100
                print(f"   - Percentage: {percentage:.1f}%")
        except Exception as e:
            # Column might not exist yet - skip this check
            print(f"\n[7] Recommendations Using Sentiment:")
            print(f"   - Skipped (sentiment_score column may not exist in database)")
    
    print("\n" + "=" * 60)
    print("Status check complete!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(check_sentiment_status())

