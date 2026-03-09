"""Dependency injection container."""

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

import redis.asyncio as aioredis
import structlog

from src.infrastructure.config.settings import Settings, get_settings

if TYPE_CHECKING:
    from redis.asyncio.client import Redis


@dataclass
class Container:
    """Simple dependency injection container."""

    settings: Settings
    redis_client: "Redis[Any]"
    logger: structlog.stdlib.BoundLogger

    async def health_check(self) -> dict[str, bool]:
        """Check health of all dependencies."""
        checks: dict[str, bool] = {}

        # Redis health
        try:
            await self.redis_client.ping()
            checks["redis"] = True
        except Exception:
            checks["redis"] = False

        return checks

    async def close(self) -> None:
        """Close all connections."""
        await self.redis_client.aclose()


_container: Container | None = None


async def init_container() -> Container:
    """Initialize the dependency container."""
    global _container

    if _container is not None:
        return _container

    settings = get_settings()

    # Configure structured logging
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    logger: structlog.stdlib.BoundLogger = structlog.get_logger("pymes.worker")

    # Initialize Redis client
    redis_client = aioredis.Redis(
        host=settings.redis_host,
        port=settings.redis_port,
        decode_responses=True,
    )

    _container = Container(
        settings=settings,
        redis_client=redis_client,
        logger=logger,
    )

    return _container


def get_container() -> Container:
    """Get the current container instance."""
    if _container is None:
        raise RuntimeError("Container not initialized. Call init_container() first.")
    return _container


async def close_container() -> None:
    """Close the container and all connections."""
    global _container
    if _container is not None:
        await _container.close()
        _container = None
