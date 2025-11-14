#!/usr/bin/env python3
"""Script to train ML models using historical data"""
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
from app.services.ml_service import train_models
from app.crud.market_data import get_market_data_count


async def main():
    """Train ML models using historical data"""
    print("=" * 60)
    print("ML Model Training Script (Using Historical Data)")
    print("=" * 60)
    
    async with async_session_maker() as session:
        # Check market data availability
        print("\n[Step 1] Checking historical data availability...")
        print("-" * 60)
        market_data_count = await get_market_data_count(session)
        print(f"Total market data records in database: {market_data_count}")
        
        if market_data_count == 0:
            print("⚠ No market data found in database.")
            print("  Please collect market data first using:")
            print("  python scripts/collect_market_data.py")
            return 1
        
        if market_data_count < 50:
            print(f"⚠ Only {market_data_count} records found.")
            print("  More data will improve model quality, but training will proceed with available data.")
        
        # Train models using historical data
        print("\n[Step 2] Training ML models...")
        print("-" * 60)
        
        # Use historical data - try to get as much as possible
        # Using 180 days (6 months) to maximize training data
        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=180)
        
        print(f"Training date range: {start_date.date()} to {end_date.date()}")
        print("Note: Uses all available historical data in this range from database")
        print("This may take several minutes...")
        print("-" * 60)
        
        try:
            results = await train_models(
                session=session,
                start_date=start_date,
                end_date=end_date,
                train_neural_network=True,
                train_random_forest_model=True,
            )
            
            print("\n✓ Model training completed!")
            print(f"  Version: {results.get('version')}")
            print(f"  Dataset size: {results.get('dataset_size')} samples")
            print(f"  Features: {results.get('feature_count')}")
            print(f"  Training date range: {results.get('data_range', {}).get('start_date')} to {results.get('data_range', {}).get('end_date')}")
            
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
            print("⚠ IMPORTANT: Restart the backend server for models to load")
            print("  Run: python manage.py run-server")
            
        except ValueError as e:
            if "No training data" in str(e):
                print(f"\n⚠ Not enough historical data for training: {e}")
                print("  The training function uses all available historical data in the database.")
                print("  Options:")
                print("  1. Run market data collection multiple times:")
                print("     python scripts/collect_market_data.py")
                print("  2. Wait for scheduled hourly collection jobs to accumulate data")
                print("  3. Import historical data if available from other sources")
                return 1
            else:
                print(f"\n✗ Training failed: {e}")
                return 1
        except Exception as e:
            print(f"\n✗ Training failed: {e}")
            import traceback
            traceback.print_exc()
            return 1
    
    # Cleanup
    await engine.dispose()
    print("\n" + "=" * 60)
    print("Script completed!")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

