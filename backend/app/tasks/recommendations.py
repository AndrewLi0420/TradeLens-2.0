"""Scheduled tasks for recommendation generation"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.services.recommendation_service import generate_recommendations
from app.users.models import User
from sqlalchemy import select

logger = logging.getLogger(__name__)


async def scheduled_generation(
    session: AsyncSession,
    user_id: UUID,
    daily_target_count: int = 10,
) -> int:
    """
    Scheduled entrypoint to generate recommendations.

    Returns number of recommendations created.
    """
    logger.info(
        "Starting scheduled recommendation generation at %s (target=%d)",
        datetime.now(timezone.utc).isoformat(),
        daily_target_count,
    )

    recs = await generate_recommendations(
        session=session,
        user_id=user_id,
        daily_target_count=daily_target_count,
        use_ensemble=True,
        market_conditions=None,
    )

    logger.info("Scheduled generation completed: %d recommendations", len(recs))
    return len(recs)


async def recommendations_job(daily_target_count: int = 10) -> None:
    """APScheduler job to generate recommendations for all users.

    - Creates isolated DB engine/session
    - Iterates all users
    - Enforces soft latency target (<60s) with logging
    """
    logger.info(
        "Starting recommendations job at %s (target per user=%d)",
        datetime.now(timezone.utc).isoformat(),
        daily_target_count,
    )
    
    # Diagnostic: Check model module state and model availability
    import sys
    import inspect
    from app.services.ml_service import are_models_loaded
    
    logger.info("=== recommendations_job Model Diagnostics ===")
    logger.info("ML service module in sys.modules: %s", 'app.services.ml_service' in sys.modules)
    if 'app.services.ml_service' in sys.modules:
        ml_module = sys.modules['app.services.ml_service']
        logger.info("ML service module object: %s", ml_module)
        logger.info("ML service module __file__: %s", getattr(ml_module, '__file__', 'N/A'))
        
        # Check if model variables exist in module
        has_nn = hasattr(ml_module, '_neural_network_model')
        has_rf = hasattr(ml_module, '_random_forest_model')
        logger.info("Module has _neural_network_model attribute: %s", has_nn)
        logger.info("Module has _random_forest_model attribute: %s", has_rf)
        
        if has_nn:
            nn_model = getattr(ml_module, '_neural_network_model', None)
            logger.info("_neural_network_model is None: %s", nn_model is None)
            logger.info("_neural_network_model ID: %s", id(nn_model) if nn_model is not None else "None")
        
        if has_rf:
            rf_model = getattr(ml_module, '_random_forest_model', None)
            logger.info("_random_forest_model is None: %s", rf_model is None)
            logger.info("_random_forest_model ID: %s", id(rf_model) if rf_model is not None else "None")
    
    # Check are_models_loaded() function
    models_loaded = are_models_loaded()
    logger.info("are_models_loaded() returns: %s", models_loaded)
    
    # Check app.state if available (will be set in lifetime.py)
    try:
        from app.main import app
        if hasattr(app, 'state') and hasattr(app.state, 'models'):
            models = app.state.models
            logger.info("app.state.models available: %s", models is not None)
            if models:
                logger.info("app.state.models keys: %s", list(models.keys()))
                nn_in_state = models.get("neural_network") is not None
                rf_in_state = models.get("random_forest") is not None
                logger.info("Neural network in app.state: %s", nn_in_state)
                logger.info("Random forest in app.state: %s", rf_in_state)
                if nn_in_state:
                    logger.info("Neural network ID from app.state: %s", id(models["neural_network"]))
                if rf_in_state:
                    logger.info("Random forest ID from app.state: %s", id(models["random_forest"]))
        else:
            logger.warning("app.state.models not available in recommendations_job")
    except Exception as e:
        logger.warning("Could not access app.state in recommendations_job: %s", e)

    start = time.time()
    engine = None
    try:
        engine = create_async_engine(str(settings.DATABASE_URI))
        async_session_maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async with async_session_maker() as session:
            # Fetch all users
            users = (await session.execute(select(User))).scalars().all()
            if not users:
                logger.warning("No users found; skipping recommendations job")
                return

            total_created = 0
            for u in users:
                try:
                    created = await scheduled_generation(
                        session=session,
                        user_id=u.id,
                        daily_target_count=daily_target_count,
                    )
                    total_created += created
                except Exception as e:
                    logger.error("Generation failed for user %s: %s", u.id, e, exc_info=True)

            duration = time.time() - start
            logger.info(
                "Recommendations job completed: total=%d in %.2fs",
                total_created,
                duration,
            )
            if duration > 60.0:
                logger.warning("Recommendations job exceeded latency target: %.2fs > 60s", duration)
    finally:
        if engine is not None:
            try:
                await engine.dispose()
            except Exception:
                pass

