"""Testcontainers fixtures for integration testing."""

from collections.abc import Generator
from dataclasses import dataclass
from typing import Any

import pytest
from testcontainers.postgres import PostgresContainer
from testcontainers.redis import RedisContainer


@dataclass
class PostgresConnectionParams:
    """Connection parameters for PostgreSQL test container."""

    host: str
    port: int
    user: str
    password: str
    database: str

    @property
    def url(self) -> str:
        """Build SQLAlchemy-compatible connection URL."""
        return (
            f"postgresql://{self.user}:{self.password}"
            f"@{self.host}:{self.port}/{self.database}"
        )

    @property
    def async_url(self) -> str:
        """Build async SQLAlchemy-compatible connection URL."""
        return (
            f"postgresql+asyncpg://{self.user}:{self.password}"
            f"@{self.host}:{self.port}/{self.database}"
        )


@dataclass
class RedisConnectionParams:
    """Connection parameters for Redis test container."""

    host: str
    port: int

    @property
    def url(self) -> str:
        """Build Redis connection URL."""
        return f"redis://{self.host}:{self.port}"


@pytest.fixture(scope="session")
def postgres_container() -> Generator[PostgresConnectionParams, None, None]:
    """Create a PostgreSQL container for the test session.

    Yields connection parameters that can be used to connect to the container.
    Container is automatically stopped and removed after tests complete.
    """
    with PostgresContainer(
        image="postgres:16-alpine",
        username="test",
        password="test",
        dbname="test_db",
    ) as container:
        # Get mapped host and port
        host = container.get_container_host_ip()
        port = int(container.get_exposed_port(5432))

        yield PostgresConnectionParams(
            host=host,
            port=port,
            user="test",
            password="test",
            database="test_db",
        )


@pytest.fixture(scope="session")
def redis_container() -> Generator[RedisConnectionParams, None, None]:
    """Create a Redis container for the test session.

    Yields connection parameters that can be used to connect to the container.
    Container is automatically stopped and removed after tests complete.
    """
    with RedisContainer(image="redis:7-alpine") as container:
        # Get mapped host and port
        host = container.get_container_host_ip()
        port = int(container.get_exposed_port(6379))

        yield RedisConnectionParams(
            host=host,
            port=port,
        )
