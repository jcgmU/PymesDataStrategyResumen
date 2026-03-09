# PYMES Worker ETL

ETL Worker Service for PYMES Data Strategy - processes data transformation jobs with Human-in-the-Loop AI assistance.

## Features

- **FastAPI** HTTP server for health checks and admin endpoints
- **BullMQ** worker for consuming transformation jobs from Redis queue
- **Polars/Pandas** for high-performance data processing
- **MinIO/S3** integration for dataset storage
- **Hexagonal Architecture** for clean separation of concerns

## Development

```bash
# Install dependencies
uv sync

# Run development server
uv run uvicorn src.main:app --reload --port 8000

# Run tests
uv run pytest
```

## Health Endpoints

- `GET /health` - Full health check with dependency status
- `GET /health/live` - Kubernetes liveness probe
- `GET /health/ready` - Kubernetes readiness probe
