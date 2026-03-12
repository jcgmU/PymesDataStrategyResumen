"""Tests for FastAPI application factory."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.infrastructure.config.settings import Settings


class TestCreateApp:
    """Test suite for create_app factory function."""

    @pytest.fixture
    def dev_settings(self) -> Settings:
        """Create development settings."""
        with patch.dict("os.environ", {"ENVIRONMENT": "development"}):
            return Settings()

    @pytest.fixture
    def prod_settings(self) -> Settings:
        """Create production settings."""
        with patch.dict("os.environ", {"ENVIRONMENT": "production"}):
            return Settings()

    def test_create_app_returns_fastapi_instance(self) -> None:
        """Test that create_app returns a FastAPI instance."""
        with patch(
            "src.infrastructure.http.app.get_settings"
        ) as mock_get_settings:
            mock_get_settings.return_value = Settings()
            
            from src.infrastructure.http.app import create_app

            app = create_app()

            assert isinstance(app, FastAPI)

    def test_create_app_sets_title(self) -> None:
        """Test that create_app sets the correct title."""
        with patch(
            "src.infrastructure.http.app.get_settings"
        ) as mock_get_settings:
            mock_get_settings.return_value = Settings()
            
            from src.infrastructure.http.app import create_app

            app = create_app()

            assert app.title == "PYMES Worker ETL"

    def test_create_app_sets_description(self) -> None:
        """Test that create_app sets the correct description."""
        with patch(
            "src.infrastructure.http.app.get_settings"
        ) as mock_get_settings:
            mock_get_settings.return_value = Settings()
            
            from src.infrastructure.http.app import create_app

            app = create_app()

            assert app.description == "ETL Worker Service for PYMES Data Strategy"

    def test_create_app_sets_version(self) -> None:
        """Test that create_app sets the correct version."""
        with patch(
            "src.infrastructure.http.app.get_settings"
        ) as mock_get_settings:
            mock_get_settings.return_value = Settings()
            
            from src.infrastructure.http.app import create_app

            app = create_app()

            assert app.version == "0.1.0"

    def test_create_app_enables_docs_in_development(self, dev_settings: Settings) -> None:
        """Test that docs are enabled in development mode."""
        with patch(
            "src.infrastructure.http.app.get_settings"
        ) as mock_get_settings:
            mock_get_settings.return_value = dev_settings
            
            from src.infrastructure.http.app import create_app

            app = create_app()

            assert app.docs_url == "/docs"
            assert app.redoc_url == "/redoc"

    def test_create_app_disables_docs_in_production(self, prod_settings: Settings) -> None:
        """Test that docs are disabled in production mode."""
        with patch(
            "src.infrastructure.http.app.get_settings"
        ) as mock_get_settings:
            mock_get_settings.return_value = prod_settings
            
            from src.infrastructure.http.app import create_app

            app = create_app()

            assert app.docs_url is None
            assert app.redoc_url is None

    def test_create_app_includes_health_router(self) -> None:
        """Test that health router is included."""
        with patch(
            "src.infrastructure.http.app.get_settings"
        ) as mock_get_settings:
            mock_get_settings.return_value = Settings()
            
            from src.infrastructure.http.app import create_app

            app = create_app()
            client = TestClient(app, raise_server_exceptions=False)

            # Check that health endpoints are available
            response = client.get("/health/live")
            assert response.status_code == 200


class TestAppCORS:
    """Test suite for CORS middleware configuration."""

    def test_cors_enabled_in_development(self) -> None:
        """Test that CORS is enabled in development mode."""
        with patch.dict("os.environ", {"ENVIRONMENT": "development"}):
            with patch(
                "src.infrastructure.http.app.get_settings"
            ) as mock_get_settings:
                mock_get_settings.return_value = Settings()
                
                from src.infrastructure.http.app import create_app

                app = create_app()
                client = TestClient(app, raise_server_exceptions=False)

                # Test CORS headers
                response = client.options(
                    "/health/live",
                    headers={
                        "Origin": "http://localhost:3000",
                        "Access-Control-Request-Method": "GET",
                    },
                )
                
                # In development, CORS should allow any origin
                assert "access-control-allow-origin" in response.headers


class TestAppLifespan:
    """Test suite for application lifespan events."""

    @pytest.mark.asyncio
    async def test_lifespan_initializes_container(self) -> None:
        """Test that lifespan initializes the container on startup."""
        with patch(
            "src.infrastructure.http.app.init_container"
        ) as mock_init:
            with patch(
                "src.infrastructure.http.app.close_container"
            ) as mock_close:
                mock_container = AsyncMock()
                mock_container.settings.environment = "test"
                mock_container.settings.port = 8000
                mock_container.logger.info = AsyncMock()
                mock_init.return_value = mock_container

                from src.infrastructure.http.app import lifespan
                from fastapi import FastAPI

                app = FastAPI()

                async with lifespan(app):
                    mock_init.assert_awaited_once()

                mock_close.assert_awaited_once()
