"""Tests for Settings configuration."""

import os
from unittest.mock import patch

import pytest
from pydantic import ValidationError

from src.infrastructure.config.settings import Settings, get_settings


class TestSettingsDefaults:
    """Test suite for Settings default values."""

    def test_default_environment(self) -> None:
        """Test that default environment is development."""
        with patch.dict(os.environ, {}, clear=True):
            settings = Settings()
        assert settings.environment == "development"

    def test_default_port(self) -> None:
        """Test that default port is 8000."""
        settings = Settings()
        assert settings.port == 8000

    def test_default_log_level(self) -> None:
        """Test that default log level is info."""
        settings = Settings()
        assert settings.log_level == "info"

    def test_default_redis_settings(self) -> None:
        """Test default Redis configuration."""
        settings = Settings()
        assert settings.redis_host == "localhost"
        assert settings.redis_port == 6379

    def test_default_minio_settings(self) -> None:
        """Test default MinIO configuration."""
        settings = Settings()
        assert settings.minio_endpoint == "localhost"
        assert settings.minio_port == 9000
        assert settings.minio_use_ssl is False
        assert settings.minio_bucket_datasets == "datasets"
        assert settings.minio_bucket_results == "results"
        assert settings.minio_bucket_temp == "temp"

    def test_default_worker_concurrency(self) -> None:
        """Test default worker concurrency."""
        settings = Settings()
        assert settings.worker_concurrency == 2


class TestSettingsFromEnvironment:
    """Test suite for Settings loading from environment variables."""

    def test_load_environment_from_env(self) -> None:
        """Test loading environment from ENV variable."""
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
            settings = Settings()
        assert settings.environment == "production"

    def test_load_port_from_env(self) -> None:
        """Test loading port from ENV variable."""
        with patch.dict(os.environ, {"PORT": "9000"}):
            settings = Settings()
        assert settings.port == 9000

    def test_load_redis_settings_from_env(self) -> None:
        """Test loading Redis settings from ENV variables."""
        env_vars = {
            "REDIS_HOST": "redis.example.com",
            "REDIS_PORT": "6380",
        }
        with patch.dict(os.environ, env_vars):
            settings = Settings()
        assert settings.redis_host == "redis.example.com"
        assert settings.redis_port == 6380

    def test_load_minio_settings_from_env(self) -> None:
        """Test loading MinIO settings from ENV variables."""
        env_vars = {
            "MINIO_ENDPOINT": "minio.example.com",
            "MINIO_PORT": "9001",
            "MINIO_ACCESS_KEY": "my-access-key",
            "MINIO_SECRET_KEY": "my-secret-key",
            "MINIO_USE_SSL": "true",
        }
        with patch.dict(os.environ, env_vars):
            settings = Settings()
        assert settings.minio_endpoint == "minio.example.com"
        assert settings.minio_port == 9001
        assert settings.minio_access_key == "my-access-key"
        assert settings.minio_secret_key == "my-secret-key"
        assert settings.minio_use_ssl is True

    def test_case_insensitive_env_vars(self) -> None:
        """Test that environment variables are case insensitive."""
        with patch.dict(os.environ, {"environment": "test"}):
            settings = Settings()
        assert settings.environment == "test"


class TestSettingsValidation:
    """Test suite for Settings validation."""

    def test_invalid_environment_value(self) -> None:
        """Test that invalid environment value raises error."""
        with patch.dict(os.environ, {"ENVIRONMENT": "invalid"}):
            with pytest.raises(ValidationError) as exc_info:
                Settings()
        assert "environment" in str(exc_info.value)

    def test_invalid_log_level(self) -> None:
        """Test that invalid log level raises error."""
        with patch.dict(os.environ, {"LOG_LEVEL": "verbose"}):
            with pytest.raises(ValidationError) as exc_info:
                Settings()
        assert "log_level" in str(exc_info.value)

    def test_port_below_minimum(self) -> None:
        """Test that port below 1 raises error."""
        with patch.dict(os.environ, {"PORT": "0"}):
            with pytest.raises(ValidationError) as exc_info:
                Settings()
        assert "port" in str(exc_info.value).lower()

    def test_port_above_maximum(self) -> None:
        """Test that port above 65535 raises error."""
        with patch.dict(os.environ, {"PORT": "70000"}):
            with pytest.raises(ValidationError) as exc_info:
                Settings()
        assert "port" in str(exc_info.value).lower()

    def test_worker_concurrency_below_minimum(self) -> None:
        """Test that worker concurrency below 1 raises error."""
        with patch.dict(os.environ, {"WORKER_CONCURRENCY": "0"}):
            with pytest.raises(ValidationError) as exc_info:
                Settings()
        assert "worker_concurrency" in str(exc_info.value)

    def test_worker_concurrency_above_maximum(self) -> None:
        """Test that worker concurrency above 10 raises error."""
        with patch.dict(os.environ, {"WORKER_CONCURRENCY": "15"}):
            with pytest.raises(ValidationError) as exc_info:
                Settings()
        assert "worker_concurrency" in str(exc_info.value)


class TestSettingsProperties:
    """Test suite for Settings computed properties."""

    def test_redis_url_property(self) -> None:
        """Test redis_url property construction."""
        env_vars = {
            "REDIS_HOST": "redis.local",
            "REDIS_PORT": "6380",
        }
        with patch.dict(os.environ, env_vars):
            settings = Settings()
        assert settings.redis_url == "redis://redis.local:6380"

    def test_minio_url_http(self) -> None:
        """Test minio_url property with HTTP."""
        env_vars = {
            "MINIO_ENDPOINT": "minio.local",
            "MINIO_PORT": "9000",
            "MINIO_USE_SSL": "false",
        }
        with patch.dict(os.environ, env_vars):
            settings = Settings()
        assert settings.minio_url == "http://minio.local:9000"

    def test_minio_url_https(self) -> None:
        """Test minio_url property with HTTPS."""
        env_vars = {
            "MINIO_ENDPOINT": "minio.secure.com",
            "MINIO_PORT": "443",
            "MINIO_USE_SSL": "true",
        }
        with patch.dict(os.environ, env_vars):
            settings = Settings()
        assert settings.minio_url == "https://minio.secure.com:443"

    def test_is_development_true(self) -> None:
        """Test is_development returns True for development env."""
        with patch.dict(os.environ, {"ENVIRONMENT": "development"}):
            settings = Settings()
        assert settings.is_development is True

    def test_is_development_false_for_production(self) -> None:
        """Test is_development returns False for production env."""
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
            settings = Settings()
        assert settings.is_development is False

    def test_is_development_false_for_test(self) -> None:
        """Test is_development returns False for test env."""
        with patch.dict(os.environ, {"ENVIRONMENT": "test"}):
            settings = Settings()
        assert settings.is_development is False


class TestGetSettings:
    """Test suite for get_settings function."""

    def test_get_settings_returns_settings(self) -> None:
        """Test that get_settings returns a Settings instance."""
        # Clear cache first
        get_settings.cache_clear()
        settings = get_settings()
        assert isinstance(settings, Settings)

    def test_get_settings_is_cached(self) -> None:
        """Test that get_settings returns cached instance."""
        get_settings.cache_clear()
        settings1 = get_settings()
        settings2 = get_settings()
        assert settings1 is settings2
