from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.memory import MemoryJobStore

from app.core.config import settings
from app.core.logger import logger
from app.initial_data import create_superuser
from app.services.ml_service import initialize_models
from app.tasks.market_data import collect_market_data_job
from app.tasks.sentiment import collect_sentiment_job
from app.tasks.recommendations import recommendations_job

# Global scheduler instance
scheduler: AsyncIOScheduler | None = None


async def startup() -> None:
    """Startup tasks - create superuser and initialize scheduler"""
    try:
        await create_superuser()
        logger.info("Superuser check completed")
    except Exception as e:
        logger.error("Error creating superuser: %s", e, exc_info=True)
    
    # Market data collection uses yfinance (no API key required)
    logger.info("Market data collection enabled (using yfinance)")
    
    # Initialize APScheduler
    try:
        global scheduler
        scheduler = AsyncIOScheduler(
            jobstores={"default": MemoryJobStore()},
            timezone="UTC",
        )
        
        # Add hourly market data collection job
        # Runs every hour at minute 0 (e.g., 1:00, 2:00, 3:00, etc.)
        scheduler.add_job(
            collect_market_data_job,
            "cron",
            hour="*",
            minute=0,
            id="market_data_collection",
            name="Market Data Collection",
            max_instances=1,  # Prevent overlapping runs
            coalesce=True,  # Combine multiple pending executions into one
        )

        # Add hourly sentiment collection job (top of the hour + 5 minutes to stagger)
        scheduler.add_job(
            collect_sentiment_job,
            "cron",
            hour="*",
            minute=5,
            id="sentiment_collection",
            name="Sentiment Collection (Web Scraping)",
            max_instances=1,
            coalesce=True,
        )

        # Add hourly recommendations generation job (top of the hour + 10 minutes to follow data jobs)
        scheduler.add_job(
            recommendations_job,
            "cron",
            hour="*",
            minute=10,
            id="recommendations_generation",
            name="Recommendations Generation",
            max_instances=1,
            coalesce=True,
        )
        
        scheduler.start()
        logger.info("APScheduler started - market data, sentiment, and recommendations jobs scheduled")
    except Exception as e:
        logger.error("Error initializing scheduler: %s", e, exc_info=True)
    
    # Initialize ML models for inference
    # Run in executor since initialize_models() is a blocking sync function
    import asyncio
    import os
    import time
    from concurrent.futures import ThreadPoolExecutor
    from pathlib import Path
    
    # Enhanced diagnostic logging: Check working directory and ml-models folder
    logger.info("=== ML Model Initialization Diagnostics ===")
    logger.info("Working directory: %s", os.getcwd())
    
    # Determine backend root and ml-models path
    backend_root = Path(__file__).parent.parent
    ml_models_path = backend_root / "ml-models"
    logger.info("Backend root (calculated from lifetime.py path): %s", backend_root)
    logger.info("ML models path: %s", ml_models_path)
    logger.info("ML models path exists: %s", ml_models_path.exists())
    
    if ml_models_path.exists():
        model_files = list(ml_models_path.glob("*.pth")) + list(ml_models_path.glob("*.pkl"))
        metadata_files = list(ml_models_path.glob("*_metadata.json"))
        logger.info("Found %d model files (.pth/.pkl) and %d metadata files", len(model_files), len(metadata_files))
        if model_files:
            logger.info("Model files: %s", [f.name for f in model_files])
        if metadata_files:
            logger.info("Metadata files: %s", [f.name for f in metadata_files])
    else:
        logger.warning("ml-models folder NOT found at: %s", ml_models_path)
    
    # Check configurable startup behavior (default: graceful degradation)
    require_models = os.getenv("REQUIRE_ML_MODELS", "false").lower() == "true"
    logger.info("Model requirement mode: %s (set REQUIRE_ML_MODELS=true to fail startup if models missing)", 
                "strict" if require_models else "graceful")
    
    logger.info("Initializing ML models for inference...")
    load_start_time = time.time()
    try:
        # Run blocking model loading in thread pool to avoid blocking event loop
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor() as executor:
            model_init_results = await loop.run_in_executor(executor, initialize_models)
        
        load_duration = time.time() - load_start_time
        logger.info("Model loading completed in %.2f seconds", load_duration)
        
        # Enhanced logging: Log file paths, versions, and metadata
        logger.info("=== Model Loading Results ===")
        nn_status = model_init_results["neural_network"]
        rf_status = model_init_results["random_forest"]
        
        # Neural Network diagnostics
        if nn_status["loaded"]:
            logger.info("✓ Neural Network Model:")
            logger.info("  - Version: %s", nn_status["version"])
            logger.info("  - Status: Loaded successfully")
            if nn_status.get("file_path"):
                logger.info("  - File path: %s", nn_status["file_path"])
            if nn_status.get("metadata"):
                logger.info("  - Metadata: %s", nn_status.get("metadata"))
        else:
            error_msg = nn_status.get("error", "Unknown error")
            logger.warning("✗ Neural Network Model: NOT LOADED")
            logger.warning("  - Error: %s", error_msg)
            if nn_status.get("file_path"):
                logger.warning("  - Attempted file path: %s", nn_status["file_path"])
        
        # Random Forest diagnostics
        if rf_status["loaded"]:
            logger.info("✓ Random Forest Model:")
            logger.info("  - Version: %s", rf_status["version"])
            logger.info("  - Status: Loaded successfully")
            if rf_status.get("file_path"):
                logger.info("  - File path: %s", rf_status["file_path"])
            if rf_status.get("metadata"):
                logger.info("  - Metadata: %s", rf_status.get("metadata"))
        else:
            error_msg = rf_status.get("error", "Unknown error")
            logger.warning("✗ Random Forest Model: NOT LOADED")
            logger.warning("  - Error: %s", error_msg)
            if rf_status.get("file_path"):
                logger.warning("  - Attempted file path: %s", rf_status["file_path"])
        
        # Verify models are accessible from module globals and app.state
        if nn_status["loaded"] or rf_status["loaded"]:
            from app.services.ml_service import are_models_loaded, _get_neural_network_model, _get_random_forest_model
            from app.services.ml_service import _get_neural_network_metadata, _get_random_forest_metadata
            
            # Check module globals accessibility
            nn_model_global = _get_neural_network_model()
            rf_model_global = _get_random_forest_model()
            nn_metadata_global = _get_neural_network_metadata()
            rf_metadata_global = _get_random_forest_metadata()
            
            logger.info("=== Model Accessibility Verification ===")
            logger.info("Module globals - Neural Network: %s", "accessible" if nn_model_global is not None else "NOT accessible")
            logger.info("Module globals - Random Forest: %s", "accessible" if rf_model_global is not None else "NOT accessible")
            
            models_accessible = are_models_loaded()
            if models_accessible:
                logger.info("✓ ML inference service ready (at least one model loaded AND accessible)")
            else:
                logger.error(
                    "⚠️  WARNING: Models reported as loaded but NOT accessible from main thread! "
                    "This indicates a module isolation issue. Models may not work in scheduled jobs."
                )
            
            # Store models in app.state as backup storage mechanism
            try:
                from app.main import app
                import app.services.ml_service as ml_service
                
                # Access models via module attribute (safer than direct import of private vars)
                nn_model = getattr(ml_service, '_neural_network_model', None)
                nn_metadata = getattr(ml_service, '_neural_network_metadata', None)
                rf_model = getattr(ml_service, '_random_forest_model', None)
                rf_metadata = getattr(ml_service, '_random_forest_metadata', None)
                
                # Store models in app.state
                app.state.models = {
                    "neural_network": nn_model,
                    "neural_network_metadata": nn_metadata,
                    "random_forest": rf_model,
                    "random_forest_metadata": rf_metadata,
                }
                logger.info("✓ Models stored in app.state as backup storage")
                logger.info("app.state.models keys: %s", list(app.state.models.keys()))
                
                # Verify app.state accessibility
                logger.info("app.state - Neural Network: %s", "accessible" if nn_model is not None else "NOT accessible")
                logger.info("app.state - Random Forest: %s", "accessible" if rf_model is not None else "NOT accessible")
                
                # Model accessibility test: perform test prediction call
                logger.info("=== Model Accessibility Test (Test Prediction) ===")
                try:
                    import numpy as np
                    # Create a dummy feature vector for testing (9 features as expected)
                    test_feature_vector = np.array([0.0] * 9)
                    
                    # Test neural network if available
                    if nn_model is not None:
                        try:
                            nn_model.eval()
                            import torch
                            with torch.no_grad():
                                test_tensor = torch.FloatTensor(test_feature_vector).unsqueeze(0)
                                test_output = nn_model(test_tensor)
                            logger.info("✓ Neural Network: Test prediction successful (output shape: %s)", test_output.shape)
                        except Exception as test_error:
                            logger.error("✗ Neural Network: Test prediction failed: %s", test_error)
                    
                    # Test random forest if available
                    if rf_model is not None:
                        try:
                            test_prediction = rf_model.predict([test_feature_vector])
                            logger.info("✓ Random Forest: Test prediction successful (prediction: %s)", test_prediction)
                        except Exception as test_error:
                            logger.error("✗ Random Forest: Test prediction failed: %s", test_error)
                except Exception as test_error:
                    logger.warning("Model accessibility test failed: %s", test_error, exc_info=True)
                
            except Exception as store_error:
                logger.warning("Failed to store models in app.state: %s", store_error, exc_info=True)
        else:
            # No models loaded - handle gracefully or fail based on config
            error_msg = "ML inference service unavailable: No models loaded"
            logger.error("✗ %s", error_msg)
            logger.error("   Please check that model files exist in ml-models/ directory")
            logger.error("   Run: python scripts/train_models.py to train models if needed")
            
            if require_models:
                logger.error("REQUIRE_ML_MODELS=true set - startup will fail due to missing models")
                raise RuntimeError(error_msg)
            else:
                logger.warning("Continuing startup with graceful degradation (models not required)")
    except Exception as e:
        error_msg = f"Failed to initialize ML models: {e}"
        logger.error(error_msg, exc_info=True)
        import traceback
        logger.error("Traceback: %s", traceback.format_exc())
        
        if require_models:
            logger.error("REQUIRE_ML_MODELS=true set - startup will fail due to model initialization error")
            raise RuntimeError(error_msg) from e
        else:
            logger.warning("Continuing startup with graceful degradation (model initialization error)")


async def shutdown() -> None:
    """Shutdown tasks - stop scheduler"""
    global scheduler
    if scheduler is not None:
        scheduler.shutdown(wait=True)
        logger.info("APScheduler stopped")
