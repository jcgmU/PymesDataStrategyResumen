# Specification: scaffolding-backend-mvp

**Status**: DRAFT  
**Created**: 2026-03-08  
**Change**: scaffolding-backend-mvp

---

## Overview

This specification defines the functional requirements for the initial backend scaffolding of the PYMES Data Strategy ETL system. The scaffolding establishes the foundation for parallel development of the API Gateway (Node.js) and Worker ETL (Python) services.

---

## 1. Health Check API Gateway

### REQ-1.1: Health Endpoint Availability

The API Gateway service MUST expose a health check endpoint at `/health`.

**Acceptance Criteria**:
- The endpoint MUST respond to HTTP GET requests
- The endpoint MUST return HTTP 200 when the service is healthy
- The endpoint MUST return a JSON response body

### REQ-1.2: Health Response Schema

The health endpoint response MUST conform to the following schema:

```json
{
  "status": "ok" | "degraded" | "unhealthy",
  "timestamp": "<ISO 8601 datetime>",
  "services": {
    "redis": { "status": "connected" | "disconnected" },
    "postgresql": { "status": "connected" | "disconnected" }
  }
}
```

### REQ-1.3: Dependency Health Reporting

The API health endpoint MUST include connection status for:
- Redis (BullMQ broker)
- PostgreSQL (primary database)

The overall status MUST be:
- `ok`: All dependencies connected
- `degraded`: Some dependencies disconnected but service can operate
- `unhealthy`: Critical dependencies unavailable

### Scenarios

#### Scenario 1.1: All services healthy

```gherkin
Given the API Gateway is running
  And Redis is accessible
  And PostgreSQL is accessible
When a GET request is made to /health
Then the response status code MUST be 200
  And the response body MUST contain "status": "ok"
  And services.redis.status MUST be "connected"
  And services.postgresql.status MUST be "connected"
```

#### Scenario 1.2: Redis unavailable

```gherkin
Given the API Gateway is running
  And Redis is NOT accessible
  And PostgreSQL is accessible
When a GET request is made to /health
Then the response status code MUST be 200
  And the response body MUST contain "status": "degraded"
  And services.redis.status MUST be "disconnected"
  And services.postgresql.status MUST be "connected"
```

#### Scenario 1.3: PostgreSQL unavailable

```gherkin
Given the API Gateway is running
  And Redis is accessible
  And PostgreSQL is NOT accessible
When a GET request is made to /health
Then the response status code MUST be 503
  And the response body MUST contain "status": "unhealthy"
  And services.postgresql.status MUST be "disconnected"
```

---

## 2. Health Check Worker ETL

### REQ-2.1: Worker Health Endpoint Availability

The Worker ETL service MUST expose a health check endpoint at `/health`.

**Acceptance Criteria**:
- The endpoint MUST respond to HTTP GET requests
- The endpoint MUST return HTTP 200 when the service is healthy
- The endpoint MUST return a JSON response body

### REQ-2.2: Worker Health Response Schema

The health endpoint response MUST conform to the following schema:

```json
{
  "status": "ok" | "degraded" | "unhealthy",
  "timestamp": "<ISO 8601 datetime>",
  "services": {
    "redis": { "status": "connected" | "disconnected" }
  }
}
```

### REQ-2.3: Worker Dependency Health Reporting

The Worker health endpoint MUST include connection status for:
- Redis (BullMQ broker for job consumption)

The overall status MUST be:
- `ok`: Redis connected
- `unhealthy`: Redis unavailable (worker cannot function without job queue)

### Scenarios

#### Scenario 2.1: Worker healthy

```gherkin
Given the Worker ETL service is running
  And Redis is accessible
When a GET request is made to /health
Then the response status code MUST be 200
  And the response body MUST contain "status": "ok"
  And services.redis.status MUST be "connected"
```

#### Scenario 2.2: Worker cannot connect to Redis

```gherkin
Given the Worker ETL service is running
  And Redis is NOT accessible
When a GET request is made to /health
Then the response status code MUST be 503
  And the response body MUST contain "status": "unhealthy"
  And services.redis.status MUST be "disconnected"
```

---

## 3. Docker Compose Infrastructure

### REQ-3.1: Single Command Startup

The Docker Compose configuration MUST allow starting all services with a single command.

```bash
docker-compose up
```

### REQ-3.2: Required Services

Docker Compose MUST define the following services:

| Service | Image | Purpose |
|---------|-------|---------|
| `api` | Node.js 20 | API Gateway |
| `worker` | Python 3.12 | Worker ETL |
| `redis` | Redis 7+ | Job queue broker |
| `postgresql` | PostgreSQL 15+ | Primary database |
| `minio` | MinIO | S3-compatible blob storage |

### REQ-3.3: Data Persistence

Docker Compose MUST configure named volumes for data persistence:
- `postgres_data`: PostgreSQL data directory
- `redis_data`: Redis persistence (if AOF/RDB enabled)
- `minio_data`: MinIO storage

Data MUST persist across container restarts (`docker-compose down` followed by `docker-compose up`).

### REQ-3.4: Port Exposure

Docker Compose MUST expose the following ports to the host:

| Service | Host Port | Container Port | Purpose |
|---------|-----------|----------------|---------|
| api | 3000 | 3000 | HTTP API |
| worker | 8000 | 8000 | HTTP health/metrics |
| postgresql | 5432 | 5432 | Database access |
| redis | 6379 | 6379 | Redis CLI access |
| minio | 9000 | 9000 | S3 API |
| minio | 9001 | 9001 | MinIO Console |

### REQ-3.5: Service Dependencies

Docker Compose MUST define service dependencies:
- `api` SHOULD depend on `redis`, `postgresql`
- `worker` SHOULD depend on `redis`

Services SHOULD use `healthcheck` configurations to ensure dependencies are ready.

### REQ-3.6: Environment Configuration

Docker Compose MUST support environment configuration via `.env` file.

A `.env.example` file MUST be provided documenting all required variables:
- Database connection strings
- Redis connection URL
- MinIO credentials
- Service ports

### Scenarios

#### Scenario 3.1: Start all services

```gherkin
Given Docker and Docker Compose are installed
  And the .env file is configured
When docker-compose up is executed
Then all services MUST start without errors
  And the API MUST be accessible at localhost:3000
  And the Worker MUST be accessible at localhost:8000
  And PostgreSQL MUST be accessible at localhost:5432
  And Redis MUST be accessible at localhost:6379
  And MinIO MUST be accessible at localhost:9000
```

#### Scenario 3.2: Data persistence

```gherkin
Given all services are running
  And data has been written to PostgreSQL
When docker-compose down is executed
  And docker-compose up is executed
Then the previously written PostgreSQL data MUST still exist
```

#### Scenario 3.3: Service restart isolation

```gherkin
Given all services are running
When docker-compose restart api is executed
Then only the api service MUST restart
  And other services MUST remain running
  And the api MUST reconnect to dependencies
```

---

## 4. Prisma Schema

### REQ-4.1: User Model

The Prisma schema MUST define a `User` model with the following fields:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String | @id @default(uuid()) | Primary key |
| email | String | @unique | User email address |
| name | String | | Display name |
| createdAt | DateTime | @default(now()) | Creation timestamp |
| updatedAt | DateTime | @updatedAt | Last update timestamp |

### REQ-4.2: Dataset Model

The Prisma schema MUST define a `Dataset` model with the following fields:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String | @id @default(uuid()) | Primary key |
| name | String | | Dataset display name |
| status | DatasetStatus | @default(PENDING) | Current processing status |
| sourceUrl | String? | | Original file location (S3/MinIO) |
| metadata | Json? | | Flexible metadata (JSONB) |
| userId | String | @relation | Owner reference |
| createdAt | DateTime | @default(now()) | Creation timestamp |
| updatedAt | DateTime | @updatedAt | Last update timestamp |

### REQ-4.3: Dataset Status Enum

The Prisma schema MUST define a `DatasetStatus` enum:

```prisma
enum DatasetStatus {
  PENDING       // Uploaded, awaiting processing
  PROCESSING    // Currently being transformed
  REVIEW        // Awaiting human review
  APPROVED      // Transformations approved
  FAILED        // Processing failed
  ARCHIVED      // No longer active
}
```

### REQ-4.4: TransformationLog Model

The Prisma schema MUST define a `TransformationLog` model for audit trail:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | String | @id @default(uuid()) | Primary key |
| datasetId | String | @relation | Dataset reference |
| action | String | | Transformation type |
| inputSnapshot | Json? | | State before transformation |
| outputSnapshot | Json? | | State after transformation |
| appliedBy | String? | | User or system identifier |
| createdAt | DateTime | @default(now()) | Execution timestamp |

### REQ-4.5: Model Relations

The Prisma schema MUST define the following relations:
- User 1:N Dataset (a user can own multiple datasets)
- Dataset 1:N TransformationLog (a dataset can have multiple logs)

### Scenarios

#### Scenario 4.1: Create user with dataset

```gherkin
Given the database is migrated
When a User is created with email "test@example.com"
  And a Dataset is created referencing that User
Then the Dataset.userId MUST equal the User.id
  And the Dataset.status MUST be "PENDING"
```

#### Scenario 4.2: Track transformation

```gherkin
Given a Dataset exists with status "PENDING"
When a TransformationLog is created for that Dataset
  And the Dataset status is updated to "PROCESSING"
Then the TransformationLog MUST reference the Dataset
  And the TransformationLog.createdAt MUST be set automatically
```

#### Scenario 4.3: Query user datasets

```gherkin
Given a User exists with 3 Datasets
When querying datasets for that User
Then exactly 3 Dataset records MUST be returned
  And each Dataset MUST have the correct userId
```

---

## 5. Hexagonal Architecture

### REQ-5.1: Layer Separation

Both the API Gateway and Worker ETL MUST implement hexagonal architecture with three distinct layers:

```
src/
├── domain/          # Core business logic
├── application/     # Use cases and orchestration
└── infrastructure/  # External adapters
```

### REQ-5.2: Domain Layer Independence

The `domain/` layer MUST NOT have any dependencies on:
- Infrastructure packages (prisma, bullmq, express, fastapi)
- External services (databases, message queues, HTTP)
- Framework-specific code

The domain layer MAY only import:
- Standard library modules
- Pure utility libraries (e.g., date manipulation, validation)
- Other domain layer modules

### REQ-5.3: Domain Layer Contents

The `domain/` layer MUST contain:
- **Entities**: Core business objects (User, Dataset, Transformation)
- **Ports**: Interfaces defining required operations
  - Input ports: Use case interfaces (what the application can do)
  - Output ports: Repository/service interfaces (what the domain needs)
- **Value Objects**: Immutable domain primitives (optional for MVP)

### REQ-5.4: Application Layer Contents

The `application/` layer MUST contain:
- **Use Cases**: Business operation implementations
- **DTOs**: Data transfer objects for input/output

The application layer MAY depend on:
- Domain layer (entities, ports)
- Shared utilities

The application layer MUST NOT depend on:
- Infrastructure layer
- Framework-specific code

### REQ-5.5: Infrastructure Layer Contents

The `infrastructure/` layer MUST contain:
- **Adapters**: Implementations of domain ports
  - HTTP controllers/routes
  - Database repositories (Prisma adapter)
  - Message queue clients (BullMQ adapter)
  - External service clients (S3/MinIO)
- **Configuration**: Environment and dependency setup

### REQ-5.6: Dependency Direction

Dependencies MUST flow inward only:

```
Infrastructure → Application → Domain
```

NEVER:
- Domain → Application
- Domain → Infrastructure
- Application → Infrastructure (except through dependency injection setup)

### Scenarios

#### Scenario 5.1: Domain isolation verification (API)

```gherkin
Given the API project is built
When analyzing imports in src/domain/**/*.ts
Then no imports from "prisma", "@prisma/client" MUST exist
  And no imports from "express" MUST exist
  And no imports from "bullmq" MUST exist
  And no imports from "src/infrastructure" MUST exist
```

#### Scenario 5.2: Domain isolation verification (Worker)

```gherkin
Given the Worker project is built
When analyzing imports in src/domain/**/*.py
Then no imports from "prisma", "sqlalchemy" MUST exist
  And no imports from "fastapi" MUST exist
  And no imports from "bullmq" MUST exist
  And no imports from "src.infrastructure" MUST exist
```

#### Scenario 5.3: Port implementation

```gherkin
Given a DatasetRepository port is defined in domain/ports/
When the PrismaDatasetRepository is implemented in infrastructure/
Then PrismaDatasetRepository MUST implement the DatasetRepository interface
  And the infrastructure adapter MUST be injected at application startup
```

#### Scenario 5.4: Use case dependency injection

```gherkin
Given a CreateDataset use case exists in application/
When the use case is instantiated
Then repository dependencies MUST be injected via constructor
  And the use case MUST NOT instantiate infrastructure classes directly
```

---

## Summary

| Section | Requirements | Scenarios |
|---------|-------------|-----------|
| 1. Health Check API Gateway | 3 | 3 |
| 2. Health Check Worker ETL | 3 | 2 |
| 3. Docker Compose Infrastructure | 6 | 3 |
| 4. Prisma Schema | 5 | 3 |
| 5. Hexagonal Architecture | 6 | 4 |
| **Total** | **23** | **15** |

---

## References

- Proposal: `openspec/changes/scaffolding-backend-mvp/proposal.md`
- Project Config: `openspec/config.yaml`
- RFC 2119: Key words for use in RFCs to Indicate Requirement Levels
