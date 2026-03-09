"""FastAPI application setup."""

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.infrastructure.config import close_container, get_settings, init_container
from src.infrastructure.http.routes import health_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan - startup and shutdown events."""
    # Startup
    container = await init_container()
    container.logger.info(
        "Worker ETL starting",
        environment=container.settings.environment,
        port=container.settings.port,
    )
    yield
    # Shutdown
    container.logger.info("Worker ETL shutting down")
    await close_container()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="PYMES Worker ETL",
        description="ETL Worker Service for PYMES Data Strategy",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.is_development else None,
        redoc_url="/redoc" if settings.is_development else None,
    )

    # CORS middleware
    if settings.is_development:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # Include routers
    app.include_router(health_router)

    return app
