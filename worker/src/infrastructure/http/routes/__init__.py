"""HTTP routes barrel export."""

from src.infrastructure.http.routes.health import router as health_router

__all__ = ["health_router"]
