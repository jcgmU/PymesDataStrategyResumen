"""Async database connection and session management.

Uses SQLAlchemy 2.0 async API with asyncpg driver to connect to the same
PostgreSQL 16 instance managed by Prisma for the API Gateway.
"""

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from src.infrastructure.config.settings import get_settings


def _build_async_url(database_url: str) -> str:
    """Convert a plain postgresql:// URL to postgresql+asyncpg://."""
    if database_url.startswith("postgresql+asyncpg://"):
        return database_url
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql+asyncpg://", 1)
    return database_url


def create_engine(database_url: str | None = None) -> AsyncEngine:
    """Create and return an async SQLAlchemy engine.

    Args:
        database_url: Optional explicit URL. Falls back to ``Settings.database_url``.

    Returns:
        Configured ``AsyncEngine`` instance.
    """
    url = database_url or get_settings().database_url
    async_url = _build_async_url(url)
    return create_async_engine(
        async_url,
        echo=False,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
    )


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """Build a session factory bound to the given engine.

    Args:
        engine: The async engine to bind sessions to.

    Returns:
        An ``async_sessionmaker`` that produces ``AsyncSession`` instances.
    """
    return async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
        autocommit=False,
    )


@asynccontextmanager
async def get_db_session(
    session_factory: async_sessionmaker[AsyncSession],
) -> AsyncGenerator[AsyncSession, None]:
    """Async context manager that yields a database session.

    Automatically commits on success and rolls back on exception.

    Args:
        session_factory: The session factory to use.

    Yields:
        An ``AsyncSession`` ready for use.
    """
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
