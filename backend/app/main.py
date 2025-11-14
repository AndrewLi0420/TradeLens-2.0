import sentry_sdk
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi_users.exceptions import UserAlreadyExists
from sentry_sdk.integrations.asgi import SentryAsgiMiddleware
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.redis import RedisIntegration


from .api.v1.endpoints.ml import router as ml_router
from .api.v1.endpoints.recommendations import router as recommendations_router
from .api.v1.endpoints.search import router as search_router
from .core.auth import get_auth_router
from .core.config import settings, Environment
from .db.config import register_db
from .health import router as health_check_router
from .lifetime import startup, shutdown
from .users.routes import router as users_router



def get_application() -> FastAPI:
    _app = FastAPI(
        title="My fastapi project",
        description="",
        debug=settings.DEBUG,
    )
    
    # Exception handler for user-friendly duplicate email messages (AC 5)
    @_app.exception_handler(UserAlreadyExists)
    async def user_already_exists_handler(request: Request, exc: UserAlreadyExists):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error": {
                    "type": "ValidationError",
                    "message": "An account with this email already exists",
                    "detail": str(exc)
                }
            }
        )
    
    _app.include_router(get_auth_router())
    _app.include_router(users_router)
    _app.include_router(health_check_router)
    _app.include_router(ml_router)
    _app.include_router(recommendations_router)
    _app.include_router(search_router)
    # Configure CORS - allow localhost for dev, configured origins for prod
    cors_origins = [str(origin) for origin in settings.BACKEND_CORS_ORIGINS]
    if settings.ENVIRONMENT == Environment.dev:
        # Add localhost origins for Vite dev server
        cors_origins.extend([
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
        ])
    
    _app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    if settings.ENVIRONMENT == Environment.prod:
        assert (
            settings.SENTRY_DSN
        ), "Set SENTRY_DSN to monitor and track errors in production!"
        sentry_sdk.init(
            settings.SENTRY_DSN, integrations=[LoggingIntegration(), RedisIntegration()]
        )
        _app.add_middleware(SentryAsgiMiddleware)
    
    register_db(_app)
    _app.on_event("startup")(startup)
    _app.on_event("shutdown")(shutdown)

    return _app


app = get_application()
