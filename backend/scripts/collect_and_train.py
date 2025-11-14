#!/usr/bin/env python3
"""Script to collect market data and train ML models"""
import asyncio
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone

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

from app.db.config import async_session_maker, engine
from app.tasks.market_data import collect_market_data_job
from app.services.ml_service import train_models
from app.crud.market_data import get_market_data_count


async def main():
    """Main function to collect market data and train models"""
    print("=" * 60)
    print("Market Data Collection & Model Training Script")
    print("=" * 60)
    
    # Step 1: Collect Market Data
    print("\n[Step 1] Collecting market data...")
    print("-" * 60)
    try:
        await collect_market_data_job()
        print("✓ Market data collection completed")
    except Exception as e:
        print(f"✗ Market data collection failed: {e}")
        return
    
    # Step 2: Check market data count
    print("\n[Step 2] Checking market data availability...")
    print("-" * 60)
    async with async_session_maker() as session:
        market_data_count = await get_market_data_count(session)
        print(f"Market data records: {market_data_count}")
        
        if market_data_count == 0:
            print("⚠ No market data collected. Please check:")
            print("  - yfinance is installed (pip install yfinance)")
            print("  - Stocks are loaded in database")
            print("  - Network connectivity for Yahoo Finance API")
            return
        
        # Step 3: Train Models using historical data
        print("\n[Step 3] Training ML models using historical data...")
        print("-" * 60)
        
        # Use historical data - try to get as much as possible
        # Start with 180 days, but will use whatever is available in database
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=180)  # Use 6 months of historical data
        
        print(f"Training date range: {start_date.date()} to {end_date.date()}")
        print("Note: Will use all available historical data in this range")
        print("This may take several minutes...")
        
        try:
            results = await train_models(
                session=session,
                start_date=start_date,
                end_date=end_date,
                train_neural_network=True,
                train_random_forest=True,
            )
            
            print("\n✓ Model training completed!")
            print(f"  Version: {results.get('version')}")
            print(f"  Dataset size: {results.get('dataset_size')}")
            print(f"  Features: {results.get('feature_count')}")
            
            if "neural_network" in results:
                nn = results["neural_network"]
                print(f"\n  Neural Network:")
                print(f"    Model path: {nn.get('model_path')}")
                if "metrics" in nn:
                    metrics = nn["metrics"]
                    print(f"    Accuracy: {metrics.get('accuracy', 'N/A'):.3f}")
                    print(f"    R²: {metrics.get('r_squared', 'N/A'):.3f}")
            
            if "random_forest" in results:
                rf = results["random_forest"]
                print(f"\n  Random Forest:")
                print(f"    Model path: {rf.get('model_path')}")
                if "metrics" in rf:
                    metrics = rf["metrics"]
                    print(f"    Accuracy: {metrics.get('accuracy', 'N/A'):.3f}")
                    print(f"    R²: {metrics.get('r_squared', 'N/A'):.3f}")
            
            print("\n✓ Models saved to ml-models/ directory")
            print("⚠ You need to restart the backend server for models to load")
            
        except ValueError as e:
            if "No training data" in str(e):
                print(f"⚠ Not enough historical data for training: {e}")
                print("  The training function uses all available historical data in the database.")
                print("  Options:")
                print("  1. Run market data collection multiple times to build up historical data")
                print("  2. Wait for scheduled hourly collection jobs to accumulate data")
                print("  3. Import historical data if available from other sources")
            else:
                print(f"✗ Training failed: {e}")
        except Exception as e:
            print(f"✗ Training failed: {e}")
            import traceback
            traceback.print_exc()
    
    # Cleanup
    await engine.dispose()
    print("\n" + "=" * 60)
    print("Script completed!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())

