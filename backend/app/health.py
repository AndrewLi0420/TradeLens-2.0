from fastapi import APIRouter, Response, status
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any

from app.core.logger import logger
from app.db.config import get_db
from app.db.config import async_session_maker

router = APIRouter(prefix="/api/v1/health")


class APIHealth(BaseModel):
    database_is_online: bool = True


class ModelStatus(BaseModel):
    loaded: bool
    version: str | None = None
    error: str | None = None
    accessible: bool


class MLModelsHealth(BaseModel):
    neural_network: ModelStatus
    random_forest: ModelStatus


@router.get(
    "/",
    response_model=APIHealth,
    responses={
        503: {"description": "Services are unavailable", "model": APIHealth}
    },
)
async def check_health(response: Response):
    """Check availability of API health."""
    logger.info("Health Check⛑")
    
    # Check database connection
    database_is_online = False
    try:
        async with async_session_maker() as session:
            # Simple query to test database connection
            result = await session.execute(select(text("1")))
            result.scalar()
            database_is_online = True
    except Exception as e:
        logger.warning(f"Database health check failed: {e}")
        database_is_online = False
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    
    health = APIHealth(database_is_online=database_is_online)
    return health


@router.get(
    "/ml-models",
    response_model=MLModelsHealth,
    responses={
        200: {"description": "Model status retrieved successfully"},
        503: {"description": "No models loaded", "model": MLModelsHealth}
    },
)
async def check_ml_models_health(response: Response):
    """
    Check ML model loading status and accessibility.
    
    Returns model status for both neural network and Random Forest models,
    including whether they are loaded, their versions, any errors, and
    whether they are accessible for inference.
    """
    logger.info("ML Models Health Check")
    
    from app.services.ml_service import (
        _get_neural_network_model,
        _get_random_forest_model,
        _get_neural_network_metadata,
        _get_random_forest_metadata,
        are_models_loaded,
    )
    
    # Check neural network model
    nn_model = _get_neural_network_model()
    nn_metadata = _get_neural_network_metadata()
    nn_loaded = nn_model is not None
    nn_version = nn_metadata.get("version") if nn_metadata else None
    nn_error = None
    nn_accessible = False
    
    if nn_loaded:
        # Test accessibility with a test prediction
        try:
            import numpy as np
            import torch
            nn_model.eval()
            test_feature_vector = np.array([0.0] * 9)
            with torch.no_grad():
                test_tensor = torch.FloatTensor(test_feature_vector).unsqueeze(0)
                _ = nn_model(test_tensor)
            nn_accessible = True
        except Exception as e:
            nn_error = f"Model loaded but not accessible for inference: {e}"
            logger.warning("Neural network model accessibility test failed: %s", e)
    else:
        # Check if there's error info in app.state or try to get from initialize_models result
        try:
            from app.main import app
            if hasattr(app, 'state') and hasattr(app.state, 'models'):
                # Models might not be in app.state if startup failed
                pass
        except Exception:
            pass
    
    # Check random forest model
    rf_model = _get_random_forest_model()
    rf_metadata = _get_random_forest_metadata()
    rf_loaded = rf_model is not None
    rf_version = rf_metadata.get("version") if rf_metadata else None
    rf_error = None
    rf_accessible = False
    
    if rf_loaded:
        # Test accessibility with a test prediction
        try:
            import numpy as np
            test_feature_vector = np.array([0.0] * 9)
            _ = rf_model.predict([test_feature_vector])
            rf_accessible = True
        except Exception as e:
            rf_error = f"Model loaded but not accessible for inference: {e}"
            logger.warning("Random Forest model accessibility test failed: %s", e)
    
    # Determine overall status
    any_loaded = nn_loaded or rf_loaded
    if not any_loaded:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    
    health = MLModelsHealth(
        neural_network=ModelStatus(
            loaded=nn_loaded,
            version=nn_version,
            error=nn_error,
            accessible=nn_accessible,
        ),
        random_forest=ModelStatus(
            loaded=rf_loaded,
            version=rf_version,
            error=rf_error,
            accessible=rf_accessible,
        ),
    )
    
    return health
