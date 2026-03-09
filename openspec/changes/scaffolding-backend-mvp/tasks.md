# Tasks: scaffolding-backend-mvp

**Status**: DRAFT  
**Created**: 2026-03-08  
**Estimated Time**: ~4-5 hours

---

## Phase 1: Infrastructure (Docker + Config)

### 1.1 Create Docker Compose Base
- [ ] Create `docker-compose.yml` with Redis, PostgreSQL, MinIO services
- [ ] Configure named volumes for data persistence (redis_data, postgres_data, minio_data)
- [ ] Set up healthchecks for all services
- [ ] Configure network (pymes-network)
- **Files**: `docker-compose.yml`
- **Depends on**: None

### 1.2 Create PostgreSQL Initialization
- [ ] Create `docker/postgres/` directory structure
- [ ] Create `init.sql` with uuid-ossp and pg_trgm extensions
- [ ] Mount init script in docker-compose
- **Files**: `docker/postgres/init.sql`
- **Depends on**: 1.1

### 1.3 Create MinIO Initialization
- [ ] Add minio-init service to docker-compose
- [ ] Configure bucket creation: datasets, results, temp
- [ ] Set dependency on minio service healthy
- **Files**: `docker-compose.yml` (update)
- **Depends on**: 1.1

### 1.4 Create Environment Configuration
- [ ] Create `.env.example` with all required variables
- [ ] Document PostgreSQL, Redis, MinIO, API, Worker configs
- [ ] Add `.env` to `.gitignore`
- **Files**: `.env.example`, `.gitignore`
- **Depends on**: 1.1

### 1.5 Create Development Scripts
- [ ] Create `Makefile` with common commands (up, down, logs, clean)
- [ ] Add commands for prisma migrate, generate
- [ ] Add commands for individual service restart
- **Files**: `Makefile`
- **Depends on**: 1.1, 1.4

---

## Phase 2: API Gateway Foundation

### 2.1 Initialize pnpm Workspace
- [ ] Create root `package.json` with workspace config
- [ ] Create `pnpm-workspace.yaml` for monorepo
- [ ] Initialize git repository (if not exists)
- **Files**: `package.json`, `pnpm-workspace.yaml`
- **Depends on**: None

### 2.2 Initialize API Package
- [ ] Create `api/package.json` with dependencies from design
- [ ] Configure scripts: dev, build, start, lint, typecheck
- [ ] Install dependencies with pnpm
- **Files**: `api/package.json`
- **Depends on**: 2.1

### 2.3 Configure TypeScript
- [ ] Create `api/tsconfig.json` with strict config
- [ ] Configure path aliases (@domain, @application, @infrastructure)
- [ ] Set ES2022 target, NodeNext module resolution
- **Files**: `api/tsconfig.json`
- **Depends on**: 2.2

### 2.4 Configure Linting and Formatting
- [ ] Create `api/.eslintrc.cjs` with TypeScript rules
- [ ] Create `api/.prettierrc` with formatting rules
- [ ] Create `api/nodemon.json` for dev hot reload
- **Files**: `api/.eslintrc.cjs`, `api/.prettierrc`, `api/nodemon.json`
- **Depends on**: 2.2

### 2.5 Create Hexagonal Directory Structure
- [ ] Create `api/src/domain/` with entities/, ports/, value-objects/, errors/
- [ ] Create `api/src/application/` with use-cases/, dtos/
- [ ] Create `api/src/infrastructure/` with http/, persistence/, messaging/, config/
- [ ] Create `api/src/index.ts` entry point
- **Files**: Directory structure + `api/src/index.ts`
- **Depends on**: 2.3

### 2.6 Configure Prisma
- [ ] Create `prisma/schema.prisma` with User, Dataset, TransformationJob, AuditLog models
- [ ] Define enums: UserRole, DatasetStatus, JobStatus, TransformationType
- [ ] Configure PostgreSQL datasource
- **Files**: `prisma/schema.prisma`
- **Depends on**: 2.2

### 2.7 Execute Initial Migration
- [ ] Run `pnpm prisma generate` to create client
- [ ] Run `pnpm prisma migrate dev --name init` to create tables
- [ ] Verify migration in `prisma/migrations/`
- **Files**: `prisma/migrations/*`
- **Depends on**: 2.6, 1.1 (PostgreSQL running)

---

## Phase 3: API Gateway Core

### 3.1 Implement Domain Entities
- [ ] Create `api/src/domain/entities/Dataset.ts`
- [ ] Create `api/src/domain/entities/User.ts`
- [ ] Create `api/src/domain/entities/TransformationJob.ts`
- [ ] Create barrel exports `api/src/domain/entities/index.ts`
- **Files**: `api/src/domain/entities/*.ts`
- **Depends on**: 2.5

### 3.2 Implement Domain Value Objects
- [ ] Create `api/src/domain/value-objects/DatasetId.ts`
- [ ] Create `api/src/domain/value-objects/Email.ts`
- [ ] Create `api/src/domain/value-objects/JobStatus.ts`
- [ ] Create barrel exports
- **Files**: `api/src/domain/value-objects/*.ts`
- **Depends on**: 2.5

### 3.3 Implement Domain Ports
- [ ] Create `api/src/domain/ports/repositories/DatasetRepository.ts`
- [ ] Create `api/src/domain/ports/repositories/UserRepository.ts`
- [ ] Create `api/src/domain/ports/services/JobQueueService.ts`
- [ ] Create barrel exports
- **Files**: `api/src/domain/ports/**/*.ts`
- **Depends on**: 3.1, 3.2

### 3.4 Implement Domain Errors
- [ ] Create `api/src/domain/errors/DomainError.ts` base class
- [ ] Create `api/src/domain/errors/ValidationError.ts`
- [ ] Create `api/src/domain/errors/NotFoundError.ts`
- **Files**: `api/src/domain/errors/*.ts`
- **Depends on**: 2.5

### 3.5 Implement Infrastructure Config
- [ ] Create `api/src/infrastructure/config/env.ts` with Zod validation
- [ ] Create `api/src/infrastructure/config/container.ts` for DI
- [ ] Create `api/src/infrastructure/persistence/prisma/client.ts`
- **Files**: `api/src/infrastructure/config/*.ts`, `api/src/infrastructure/persistence/prisma/client.ts`
- **Depends on**: 2.6, 3.3

### 3.6 Implement Health Controller
- [ ] Create `api/src/infrastructure/http/controllers/HealthController.ts`
- [ ] Implement Redis and PostgreSQL connectivity checks
- [ ] Return proper status (ok/degraded/unhealthy)
- **Files**: `api/src/infrastructure/http/controllers/HealthController.ts`
- **Depends on**: 3.5

### 3.7 Implement Health Route
- [ ] Create `api/src/infrastructure/http/routes/health.routes.ts`
- [ ] Create `api/src/infrastructure/http/routes/index.ts` router aggregator
- [ ] Wire HealthController to GET /health
- **Files**: `api/src/infrastructure/http/routes/*.ts`
- **Depends on**: 3.6

### 3.8 Configure Express Server
- [ ] Create `api/src/infrastructure/http/server.ts` with Express setup
- [ ] Add middleware: cors, helmet, pino-http logger
- [ ] Create `api/src/infrastructure/http/middleware/errorHandler.ts`
- [ ] Update `api/src/index.ts` to start server
- **Files**: `api/src/infrastructure/http/server.ts`, `api/src/infrastructure/http/middleware/*.ts`, `api/src/index.ts`
- **Depends on**: 3.7

### 3.9 Create API Dockerfile
- [ ] Create `api/Dockerfile.dev` for development
- [ ] Configure pnpm, prisma generate, hot reload
- [ ] Add api service to docker-compose.yml
- **Files**: `api/Dockerfile.dev`, `docker-compose.yml` (update)
- **Depends on**: 3.8, 1.1

---

## Phase 4: Worker ETL Foundation

### 4.1 Initialize Python Project
- [ ] Create `worker/pyproject.toml` with dependencies from design
- [ ] Create `worker/.python-version` (3.12)
- [ ] Run `uv sync` to create lockfile
- **Files**: `worker/pyproject.toml`, `worker/.python-version`, `worker/uv.lock`
- **Depends on**: None

### 4.2 Configure Python Linting
- [ ] Create `worker/ruff.toml` with lint rules
- [ ] Configure isort, type checking rules
- [ ] Add py.typed marker
- **Files**: `worker/ruff.toml`
- **Depends on**: 4.1

### 4.3 Create Hexagonal Directory Structure
- [ ] Create `worker/src/domain/` with entities/, ports/, value_objects/, errors/
- [ ] Create `worker/src/application/` with use_cases/, dtos/
- [ ] Create `worker/src/infrastructure/` with http/, persistence/, messaging/, storage/, config/
- [ ] Create `worker/src/main.py` entry point
- [ ] Add `__init__.py` files to all packages
- **Files**: Directory structure + `__init__.py` files + `worker/src/main.py`
- **Depends on**: 4.1

### 4.4 Implement Domain Entities
- [ ] Create `worker/src/domain/entities/transformation_job.py`
- [ ] Create `worker/src/domain/entities/dataset.py`
- [ ] Define JobStatus enum
- **Files**: `worker/src/domain/entities/*.py`
- **Depends on**: 4.3

### 4.5 Implement Domain Ports
- [ ] Create `worker/src/domain/ports/services/storage_service.py`
- [ ] Create `worker/src/domain/ports/services/job_queue_service.py`
- [ ] Create `worker/src/domain/ports/repositories/dataset_repository.py`
- **Files**: `worker/src/domain/ports/**/*.py`
- **Depends on**: 4.4

### 4.6 Implement Infrastructure Config
- [ ] Create `worker/src/infrastructure/config/settings.py` with pydantic-settings
- [ ] Create `worker/src/infrastructure/config/container.py` for DI
- [ ] Implement Redis and MinIO health check methods
- **Files**: `worker/src/infrastructure/config/*.py`
- **Depends on**: 4.5

### 4.7 Implement Health Endpoint
- [ ] Create `worker/src/infrastructure/http/app.py` FastAPI application
- [ ] Create `worker/src/infrastructure/http/routes/health.py`
- [ ] Implement Redis connectivity check
- [ ] Return proper status (ok/unhealthy)
- **Files**: `worker/src/infrastructure/http/*.py`, `worker/src/infrastructure/http/routes/health.py`
- **Depends on**: 4.6

### 4.8 Configure FastAPI Server
- [ ] Update `worker/src/main.py` to initialize FastAPI app
- [ ] Mount health router
- [ ] Configure uvicorn settings
- **Files**: `worker/src/main.py`
- **Depends on**: 4.7

### 4.9 Create Worker Dockerfile
- [ ] Create `worker/Dockerfile.dev` for development
- [ ] Configure uv, uvicorn with hot reload
- [ ] Add worker service to docker-compose.yml
- **Files**: `worker/Dockerfile.dev`, `docker-compose.yml` (update)
- **Depends on**: 4.8, 1.1

---

## Phase 5: Integration

### 5.1 Verify Docker Compose Full Stack
- [ ] Run `docker-compose up --build`
- [ ] Verify all services start without errors
- [ ] Check logs for connectivity issues
- **Files**: None (verification only)
- **Depends on**: 3.9, 4.9

### 5.2 Verify Health Endpoints
- [ ] Test `curl localhost:3000/health` returns ok
- [ ] Test `curl localhost:8000/health` returns ok
- [ ] Verify Redis connectivity reported correctly
- [ ] Verify PostgreSQL connectivity reported correctly
- **Files**: None (verification only)
- **Depends on**: 5.1

### 5.3 Verify Data Persistence
- [ ] Test PostgreSQL data persists across restarts
- [ ] Test MinIO buckets exist after init
- [ ] Verify redis_data volume works
- **Files**: None (verification only)
- **Depends on**: 5.1

### 5.4 BullMQ Spike (Python)
- [ ] Create test script to validate bullmq Python package
- [ ] Verify Worker can consume jobs from Node.js producer
- [ ] Document results (success or fallback needed)
- **Files**: `worker/spike_bullmq.py` (temporary, delete after)
- **Depends on**: 5.1

### 5.5 Create Project README
- [ ] Write setup instructions (docker-compose up)
- [ ] Document environment variables
- [ ] Add architecture overview diagram
- [ ] Document available endpoints
- [ ] Add troubleshooting section
- **Files**: `README.md`
- **Depends on**: 5.2

---

## Summary

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1: Infrastructure | 5 | 45 min |
| Phase 2: API Gateway Foundation | 7 | 60 min |
| Phase 3: API Gateway Core | 9 | 90 min |
| Phase 4: Worker ETL Foundation | 9 | 75 min |
| Phase 5: Integration | 5 | 30 min |
| **Total** | **35** | **~5 hours** |

---

## Dependency Graph

```
Phase 1 (Infrastructure)
├── 1.1 Docker Compose Base
│   ├── 1.2 PostgreSQL Init
│   ├── 1.3 MinIO Init
│   └── 1.4 Environment Config
│       └── 1.5 Development Scripts

Phase 2 (API Foundation)              Phase 4 (Worker Foundation)
├── 2.1 pnpm Workspace                ├── 4.1 Python Project Init
│   └── 2.2 API Package Init          │   └── 4.2 Python Linting
│       └── 2.3 TypeScript Config     │       └── 4.3 Hexagonal Structure
│           └── 2.4 Linting Config    │           └── 4.4 Domain Entities
│               └── 2.5 Hexagonal     │               └── 4.5 Domain Ports
│                   └── 2.6 Prisma    │                   └── 4.6 Infrastructure Config
│                       └── 2.7       │                       └── 4.7 Health Endpoint
│                           Migration │                           └── 4.8 FastAPI Server
                                      │                               └── 4.9 Worker Dockerfile

Phase 3 (API Core)
├── 3.1 Domain Entities
├── 3.2 Value Objects
│   └── 3.3 Domain Ports
│       └── 3.4 Domain Errors
│           └── 3.5 Infrastructure Config
│               └── 3.6 Health Controller
│                   └── 3.7 Health Route
│                       └── 3.8 Express Server
│                           └── 3.9 API Dockerfile

Phase 5 (Integration)
└── 5.1 Docker Compose Verification
    ├── 5.2 Health Endpoints Test
    ├── 5.3 Data Persistence Test
    ├── 5.4 BullMQ Spike
    └── 5.5 Project README
```

---

## Critical Path

1. **1.1** Docker Compose Base
2. **2.1** pnpm Workspace → **2.6** Prisma Schema → **2.7** Migration
3. **3.5** Infrastructure Config → **3.8** Express Server → **3.9** API Dockerfile
4. **4.1** Python Project → **4.7** Health Endpoint → **4.9** Worker Dockerfile  
5. **5.1** Full Stack Verification → **5.5** README

**Parallel tracks:**
- Phase 2 + Phase 4 can be executed in parallel after Phase 1
- Phase 3 depends on Phase 2, Phase 4 has no API dependencies
- Phase 5 requires both API and Worker complete

---

## Notes

- TDD is disabled per config.yaml - no test files required for MVP
- BullMQ spike (5.4) is critical - if it fails, document in ADR and evaluate alternatives
- Keep domain layer pure - no infrastructure imports allowed
- Use Context7 for Express, Prisma, FastAPI documentation as needed
