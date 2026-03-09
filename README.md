# PYMES Data Strategy - Backend

ETL system with Human-in-the-Loop for AI-assisted data cleaning.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         PYMES Backend                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    BullMQ     ┌─────────────┐                 │
│  │ API Gateway │──────────────▶│ Worker ETL  │                 │
│  │   (Node.js) │               │   (Python)  │                 │
│  │   :3000     │               │   :8000     │                 │
│  └──────┬──────┘               └──────┬──────┘                 │
│         │                             │                         │
│         │ Prisma                      │ SQLAlchemy              │
│         │                             │                         │
│  ┌──────┴──────┐               ┌──────┴──────┐                 │
│  │ PostgreSQL  │               │    MinIO    │                 │
│  │   :5433     │               │   :9000     │                 │
│  └─────────────┘               └─────────────┘                 │
│                                                                 │
│                    ┌─────────────┐                              │
│                    │    Redis    │                              │
│                    │   :6380     │                              │
│                    └─────────────┘                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

### API Gateway (Node.js)
- **Express 4.21** - Web framework
- **TypeScript 5.7** - Type safety
- **Prisma 6.4** - Database ORM
- **BullMQ 5.34** - Job queue producer
- **Zod 3.24** - Schema validation

### Worker ETL (Python)
- **FastAPI 0.115** - Web framework
- **Polars 1.23** - High-performance data processing
- **Pandas 2.2** - Data manipulation
- **BullMQ 2.9** - Job queue consumer (Python binding)
- **Pydantic 2.10** - Settings and validation

### Infrastructure
- **PostgreSQL 16** - Relational database
- **Redis 7.4** - Message broker (BullMQ)
- **MinIO** - S3-compatible object storage

## Quick Start

```bash
# Start all services
make up

# Check status
make ps

# View logs
make logs
```

## Services

| Service   | URL                       | Description          |
|-----------|---------------------------|----------------------|
| API       | http://localhost:3000     | API Gateway          |
| Worker    | http://localhost:8000     | Worker ETL           |
| MinIO     | http://localhost:9001     | Storage Console      |
| PostgreSQL| localhost:5433            | Database             |
| Redis     | localhost:6380            | Message Broker       |

## Health Endpoints

```bash
# API Gateway
curl http://localhost:3000/health

# Worker ETL
curl http://localhost:8000/health
curl http://localhost:8000/health/live   # Liveness probe
curl http://localhost:8000/health/ready  # Readiness probe
```

## Development

### Local Development (without Docker)

```bash
# Start infrastructure only
make up

# Run API locally
make api-dev

# Run Worker locally (requires uv)
make worker-dev
```

### Database

```bash
# Run migrations
make db-migrate

# Open Prisma Studio
make db-studio

# Reset database (WARNING: data loss!)
make db-reset
```

### Utilities

```bash
# PostgreSQL CLI
make psql

# Redis CLI
make redis-cli

# Install dependencies
make install

# Lint code
make lint

# Type check
make typecheck
```

## Project Structure

```
backend/
├── api/                      # API Gateway (Node.js)
│   └── src/
│       ├── domain/           # Business logic (hexagonal core)
│       │   ├── entities/
│       │   ├── value-objects/
│       │   ├── ports/
│       │   └── errors/
│       ├── application/      # Use cases and DTOs
│       └── infrastructure/   # Adapters (HTTP, DB, Queue)
│           ├── config/
│           ├── http/
│           │   ├── controllers/
│           │   ├── middleware/
│           │   └── routes/
│           └── persistence/
├── worker/                   # Worker ETL (Python)
│   └── src/
│       ├── domain/           # Business logic (hexagonal core)
│       │   ├── entities/
│       │   ├── value_objects/
│       │   ├── ports/
│       │   └── errors/
│       ├── application/      # Use cases and DTOs
│       └── infrastructure/   # Adapters (HTTP, Storage, Queue)
│           ├── config/
│           ├── http/
│           ├── messaging/
│           └── storage/
├── prisma/                   # Database schema and migrations
├── docker/                   # Docker configurations
├── openspec/                 # SDD artifacts
├── docker-compose.yml        # Container orchestration
├── Makefile                  # Development commands
└── README.md                 # This file
```

## Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Key variables:
- `POSTGRES_PORT=5433` - PostgreSQL port (avoids conflicts)
- `REDIS_PORT=6380` - Redis port (avoids conflicts)
- `API_PORT=3000` - API Gateway port
- `WORKER_PORT=8000` - Worker ETL port

## Architecture Decisions

See `openspec/` for full design documents. Key decisions:

1. **ADR-001: PostgreSQL + JSONB over MongoDB** - Simplified stack, JSONB handles document needs
2. **ADR-002: BullMQ for messaging** - Works in both Node.js and Python
3. **Hexagonal Architecture** - Clean separation of domain, application, and infrastructure

## Troubleshooting

### Port conflicts
If ports 5432 or 6379 are in use, the default `.env` uses alternate ports (5433, 6380).

### Docker issues
```bash
# Remove all containers and volumes
make clean

# Rebuild images
docker compose build --no-cache
```

### Prisma issues
```bash
# Regenerate client
make db-generate

# View current database state
make db-studio
```

## License

MIT
