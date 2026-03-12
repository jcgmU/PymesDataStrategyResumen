"""Tests for Container dependency injection."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import structlog

from src.infrastructure.config.container import (
    Container,
    close_container,
    get_container,
    init_container,
)
from src.infrastructure.config.settings import Settings


class TestContainer:
    """Test suite for Container class."""

    @pytest.fixture
    def mock_settings(self) -> Settings:
        """Create mock settings for testing."""
        return Settings()

    @pytest.fixture
    def mock_redis(self) -> AsyncMock:
        """Create mock Redis client."""
        mock = AsyncMock()
        mock.ping = AsyncMock(return_value=True)
        mock.aclose = AsyncMock()
        return mock

    @pytest.fixture
    def mock_logger(self) -> MagicMock:
        """Create mock structured logger."""
        return MagicMock(spec=structlog.stdlib.BoundLogger)

    @pytest.fixture
    def container(
        self, mock_settings: Settings, mock_redis: AsyncMock, mock_logger: MagicMock
    ) -> Container:
        """Create Container instance for testing."""
        return Container(
            settings=mock_settings,
            redis_client=mock_redis,
            logger=mock_logger,
        )

    @pytest.mark.asyncio
    async def test_health_check_redis_healthy(
        self, container: Container, mock_redis: AsyncMock
    ) -> None:
        """Test health_check returns True for Redis when ping succeeds."""
        mock_redis.ping.return_value = True

        checks = await container.health_check()

        assert checks["redis"] is True
        mock_redis.ping.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_health_check_redis_unhealthy(
        self, container: Container, mock_redis: AsyncMock
    ) -> None:
        """Test health_check returns False for Redis when ping fails."""
        mock_redis.ping.side_effect = ConnectionError("Connection refused")

        checks = await container.health_check()

        assert checks["redis"] is False

    @pytest.mark.asyncio
    async def test_close_closes_redis_connection(
        self, container: Container, mock_redis: AsyncMock
    ) -> None:
        """Test close method closes Redis connection."""
        await container.close()

        mock_redis.aclose.assert_awaited_once()


class TestInitContainer:
    """Test suite for init_container function."""

    @pytest.fixture(autouse=True)
    def reset_container(self) -> None:
        """Reset global container before each test."""
        import src.infrastructure.config.container as container_module

        container_module._container = None

    @pytest.mark.asyncio
    async def test_init_container_creates_container(self) -> None:
        """Test that init_container creates a Container instance."""
        with patch("src.infrastructure.config.container.aioredis.Redis") as mock_redis:
            mock_redis.return_value = AsyncMock()
            
            container = await init_container()

            assert isinstance(container, Container)
            assert container.settings is not None
            assert container.logger is not None

    @pytest.mark.asyncio
    async def test_init_container_returns_cached_instance(self) -> None:
        """Test that init_container returns the same instance on second call."""
        with patch("src.infrastructure.config.container.aioredis.Redis") as mock_redis:
            mock_redis.return_value = AsyncMock()
            
            container1 = await init_container()
            container2 = await init_container()

            assert container1 is container2

    @pytest.mark.asyncio
    async def test_init_container_configures_structlog(self) -> None:
        """Test that init_container configures structlog."""
        with patch("src.infrastructure.config.container.aioredis.Redis") as mock_redis:
            with patch("src.infrastructure.config.container.structlog.configure") as mock_configure:
                mock_redis.return_value = AsyncMock()
                
                await init_container()

                mock_configure.assert_called_once()


class TestGetContainer:
    """Test suite for get_container function."""

    @pytest.fixture(autouse=True)
    def reset_container(self) -> None:
        """Reset global container before each test."""
        import src.infrastructure.config.container as container_module

        container_module._container = None

    def test_get_container_raises_when_not_initialized(self) -> None:
        """Test that get_container raises RuntimeError when not initialized."""
        with pytest.raises(RuntimeError) as exc_info:
            get_container()

        assert "Container not initialized" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_get_container_returns_container_after_init(self) -> None:
        """Test that get_container returns container after init_container."""
        with patch("src.infrastructure.config.container.aioredis.Redis") as mock_redis:
            mock_redis.return_value = AsyncMock()
            
            await init_container()
            container = get_container()

            assert isinstance(container, Container)


class TestCloseContainer:
    """Test suite for close_container function."""

    @pytest.fixture(autouse=True)
    def reset_container(self) -> None:
        """Reset global container before each test."""
        import src.infrastructure.config.container as container_module

        container_module._container = None

    @pytest.mark.asyncio
    async def test_close_container_closes_connections(self) -> None:
        """Test that close_container closes container connections."""
        with patch("src.infrastructure.config.container.aioredis.Redis") as mock_redis:
            mock_client = AsyncMock()
            mock_redis.return_value = mock_client
            
            await init_container()
            await close_container()

            mock_client.aclose.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_close_container_sets_container_to_none(self) -> None:
        """Test that close_container resets global container."""
        import src.infrastructure.config.container as container_module

        with patch("src.infrastructure.config.container.aioredis.Redis") as mock_redis:
            mock_redis.return_value = AsyncMock()
            
            await init_container()
            await close_container()

            assert container_module._container is None

    @pytest.mark.asyncio
    async def test_close_container_when_not_initialized(self) -> None:
        """Test that close_container handles uninitialized state gracefully."""
        # Should not raise any exception
        await close_container()
