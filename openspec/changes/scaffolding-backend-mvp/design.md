# Technical Design: scaffolding-backend-mvp

**Status**: DRAFT  
**Created**: 2026-03-08  
**Author**: OpenCode Agent

---

## 1. Architecture Overview

### System Diagram

```
                                    PYMES Data Strategy - Backend MVP
    
    +-----------------+       +------------------+       +------------------+
    |                 |       |                  |       |                  |
    |   API Gateway   |       |      Redis       |       |   Worker ETL     |
    |   (Node.js)     +------>+    (BullMQ)      +------>+   (Python)       |
    |   Port: 3000    |       |   Port: 6379     |       |   Port: 8000     |
    |                 |       |                  |       |                  |
    +--------+--------+       +------------------+       +--------+---------+
             |                                                    |
             |                                                    |
             v                                                    v
    +--------+--------+                                  +--------+---------+
    |                 |                                  |                  |
    |   PostgreSQL    |<---------------------------------+      MinIO       |
    |   Port: 5432    |                                  |   Port: 9000     |
    |                 |                                  |   Console: 9001  |
    +-----------------+                                  +------------------+
```

### Data Flow

```
[HTTP Request] --> [API Gateway] --> [Validate & Create Job] --> [Redis/BullMQ]
                                                                       |
                                                                       v
                                                               [Worker ETL]
                                                                       |
                                                +----------------------+----------------------+
                                                |                      |                      |
                                                v                      v                      v
                                         [Process Data]        [Store in MinIO]      [Update PostgreSQL]
                                                |
                                                v
                                         [Push Result to Queue]
                                                |
                                                v
                                         [API reads result / webhook]
```

### Hexagonal Architecture Pattern

```
                        +-----------------------------------------------+
                        |                   DOMAIN                       |
                        |  (Entities, Value Objects, Domain Services)    |
                        |              No external deps                  |
                        +-----------------------------------------------+
                                            ^
                                            |
                        +-----------------------------------------------+
                        |                APPLICATION                     |
                        |    (Use Cases, Commands, Queries, Ports)       |
                        |           Orchestrates domain logic            |
                        +-----------------------------------------------+
                                            ^
                                            |
    +-------------------+-------------------+-------------------+-------------------+
    |       HTTP        |      Prisma       |      BullMQ       |       S3          |
    |     Adapter       |     Adapter       |     Adapter       |     Adapter       |
    +-------------------+-------------------+-------------------+-------------------+
                        |              INFRASTRUCTURE                    |
                        +-----------------------------------------------+
```

---

## 2. API Gateway Design

### Folder Structure

```
api/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── User.ts
│   │   │   ├── Dataset.ts
│   │   │   └── TransformationJob.ts
│   │   ├── value-objects/
│   │   │   ├── Email.ts
│   │   │   ├── DatasetId.ts
│   │   │   └── JobStatus.ts
│   │   ├── ports/
│   │   │   ├── repositories/
│   │   │   │   ├── UserRepository.ts
│   │   │   │   └── DatasetRepository.ts
│   │   │   └── services/
│   │   │       └── JobQueueService.ts
│   │   └── errors/
│   │       ├── DomainError.ts
│   │       └── ValidationError.ts
│   │
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── CreateDatasetUseCase.ts
│   │   │   ├── GetDatasetUseCase.ts
│   │   │   └── EnqueueTransformationUseCase.ts
│   │   ├── commands/
│   │   │   └── CreateDatasetCommand.ts
│   │   ├── queries/
│   │   │   └── GetDatasetQuery.ts
│   │   └── dtos/
│   │       ├── DatasetDto.ts
│   │       └── JobDto.ts
│   │
│   ├── infrastructure/
│   │   ├── http/
│   │   │   ├── server.ts
│   │   │   ├── routes/
│   │   │   │   ├── index.ts
│   │   │   │   ├── health.routes.ts
│   │   │   │   └── datasets.routes.ts
│   │   │   ├── controllers/
│   │   │   │   ├── HealthController.ts
│   │   │   │   └── DatasetController.ts
│   │   │   ├── middleware/
│   │   │   │   ├── errorHandler.ts
│   │   │   │   ├── requestLogger.ts
│   │   │   │   └── validateRequest.ts
│   │   │   └── schemas/
│   │   │       └── dataset.schema.ts
│   │   │
│   │   ├── persistence/
│   │   │   ├── prisma/
│   │   │   │   └── client.ts
│   │   │   └── repositories/
│   │   │       ├── PrismaUserRepository.ts
│   │   │       └── PrismaDatasetRepository.ts
│   │   │
│   │   ├── messaging/
│   │   │   ├── bullmq/
│   │   │   │   ├── client.ts
│   │   │   │   ├── queues.ts
│   │   │   │   └── BullMQJobQueueService.ts
│   │   │   └── events/
│   │   │       └── JobEventHandler.ts
│   │   │
│   │   └── config/
│   │       ├── env.ts
│   │       └── container.ts
│   │
│   └── index.ts
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
│
├── package.json
├── tsconfig.json
├── .eslintrc.cjs
├── .prettierrc
└── nodemon.json
```

### Example Files

#### `src/domain/entities/Dataset.ts`

```typescript
import { DatasetId } from '../value-objects/DatasetId';

export interface DatasetProps {
  id: DatasetId;
  name: string;
  description: string | null;
  userId: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class Dataset {
  private constructor(private readonly props: DatasetProps) {}

  static create(props: Omit<DatasetProps, 'id' | 'createdAt' | 'updatedAt'>): Dataset {
    return new Dataset({
      ...props,
      id: DatasetId.generate(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static reconstitute(props: DatasetProps): Dataset {
    return new Dataset(props);
  }

  get id(): DatasetId {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get metadata(): Record<string, unknown> {
    return { ...this.props.metadata };
  }

  updateMetadata(metadata: Record<string, unknown>): void {
    this.props.metadata = metadata;
    this.props.updatedAt = new Date();
  }
}
```

#### `src/domain/ports/repositories/DatasetRepository.ts`

```typescript
import { Dataset } from '../../entities/Dataset';
import { DatasetId } from '../../value-objects/DatasetId';

export interface DatasetRepository {
  save(dataset: Dataset): Promise<void>;
  findById(id: DatasetId): Promise<Dataset | null>;
  findByUserId(userId: string): Promise<Dataset[]>;
  delete(id: DatasetId): Promise<void>;
}
```

#### `src/domain/ports/services/JobQueueService.ts`

```typescript
export interface JobPayload {
  datasetId: string;
  transformationType: string;
  parameters: Record<string, unknown>;
}

export interface JobResult {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
}

export interface JobQueueService {
  enqueue(payload: JobPayload): Promise<JobResult>;
  getStatus(jobId: string): Promise<JobResult | null>;
}
```

#### `src/application/use-cases/EnqueueTransformationUseCase.ts`

```typescript
import { JobQueueService, JobPayload, JobResult } from '../../domain/ports/services/JobQueueService';
import { DatasetRepository } from '../../domain/ports/repositories/DatasetRepository';
import { DatasetId } from '../../domain/value-objects/DatasetId';

export interface EnqueueTransformationInput {
  datasetId: string;
  transformationType: string;
  parameters: Record<string, unknown>;
}

export class EnqueueTransformationUseCase {
  constructor(
    private readonly datasetRepository: DatasetRepository,
    private readonly jobQueueService: JobQueueService
  ) {}

  async execute(input: EnqueueTransformationInput): Promise<JobResult> {
    const dataset = await this.datasetRepository.findById(
      DatasetId.fromString(input.datasetId)
    );

    if (!dataset) {
      throw new Error(`Dataset not found: ${input.datasetId}`);
    }

    const payload: JobPayload = {
      datasetId: input.datasetId,
      transformationType: input.transformationType,
      parameters: input.parameters,
    };

    return this.jobQueueService.enqueue(payload);
  }
}
```

#### `src/infrastructure/http/controllers/HealthController.ts`

```typescript
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';

export class HealthController {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis
  ) {}

  async check(_req: Request, res: Response): Promise<void> {
    const checks = {
      database: false,
      redis: false,
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch {
      // Database not available
    }

    try {
      await this.redis.ping();
      checks.redis = true;
    } catch {
      // Redis not available
    }

    const allHealthy = Object.values(checks).every(Boolean);

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    });
  }
}
```

#### `src/infrastructure/messaging/bullmq/BullMQJobQueueService.ts`

```typescript
import { Queue } from 'bullmq';
import { JobQueueService, JobPayload, JobResult } from '../../../domain/ports/services/JobQueueService';
import { QUEUE_NAMES } from './queues';

export class BullMQJobQueueService implements JobQueueService {
  private readonly transformationQueue: Queue;

  constructor(redisConnection: { host: string; port: number }) {
    this.transformationQueue = new Queue(QUEUE_NAMES.TRANSFORMATION, {
      connection: redisConnection,
    });
  }

  async enqueue(payload: JobPayload): Promise<JobResult> {
    const job = await this.transformationQueue.add(
      payload.transformationType,
      payload,
      {
        removeOnComplete: 100,
        removeOnFail: 1000,
      }
    );

    return {
      jobId: job.id!,
      status: 'queued',
    };
  }

  async getStatus(jobId: string): Promise<JobResult | null> {
    const job = await this.transformationQueue.getJob(jobId);

    if (!job) {
      return null;
    }

    const state = await job.getState();
    const statusMap: Record<string, JobResult['status']> = {
      waiting: 'queued',
      active: 'processing',
      completed: 'completed',
      failed: 'failed',
    };

    return {
      jobId: job.id!,
      status: statusMap[state] ?? 'queued',
    };
  }
}
```

### TypeScript Configuration

#### `api/tsconfig.json`

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "exactOptionalPropertyTypes": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "baseUrl": ".",
    "paths": {
      "@domain/*": ["src/domain/*"],
      "@application/*": ["src/application/*"],
      "@infrastructure/*": ["src/infrastructure/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Dependencies

#### `api/package.json`

```json
{
  "name": "@pymes/api",
  "version": "0.1.0",
  "type": "module",
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "dev": "nodemon",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "format": "prettier --write src/**/*.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "express": "4.21.2",
    "zod": "3.24.2",
    "bullmq": "5.34.8",
    "ioredis": "5.4.2",
    "@prisma/client": "6.4.1",
    "dotenv": "16.4.7",
    "helmet": "8.0.0",
    "cors": "2.8.5",
    "pino": "9.6.0",
    "pino-http": "10.4.0"
  },
  "devDependencies": {
    "@types/express": "5.0.0",
    "@types/cors": "2.8.17",
    "@types/node": "22.13.5",
    "typescript": "5.7.3",
    "prisma": "6.4.1",
    "eslint": "9.21.0",
    "@eslint/js": "9.21.0",
    "typescript-eslint": "8.24.1",
    "prettier": "3.5.2",
    "nodemon": "3.1.9",
    "tsx": "4.19.2"
  }
}
```

---

## 3. Worker ETL Design

### Folder Structure

```
worker/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── __init__.py
│   │   │   ├── dataset.py
│   │   │   └── transformation_job.py
│   │   ├── value_objects/
│   │   │   ├── __init__.py
│   │   │   ├── job_status.py
│   │   │   └── file_reference.py
│   │   ├── ports/
│   │   │   ├── __init__.py
│   │   │   ├── repositories/
│   │   │   │   ├── __init__.py
│   │   │   │   └── dataset_repository.py
│   │   │   └── services/
│   │   │       ├── __init__.py
│   │   │       ├── storage_service.py
│   │   │       └── job_queue_service.py
│   │   └── errors/
│   │       ├── __init__.py
│   │       └── domain_errors.py
│   │
│   ├── application/
│   │   ├── __init__.py
│   │   ├── use_cases/
│   │   │   ├── __init__.py
│   │   │   ├── process_transformation.py
│   │   │   └── validate_dataset.py
│   │   ├── commands/
│   │   │   ├── __init__.py
│   │   │   └── transformation_command.py
│   │   └── dtos/
│   │       ├── __init__.py
│   │       └── job_dto.py
│   │
│   ├── infrastructure/
│   │   ├── __init__.py
│   │   ├── http/
│   │   │   ├── __init__.py
│   │   │   ├── app.py
│   │   │   └── routes/
│   │   │       ├── __init__.py
│   │   │       └── health.py
│   │   │
│   │   ├── persistence/
│   │   │   ├── __init__.py
│   │   │   └── postgres/
│   │   │       ├── __init__.py
│   │   │       ├── connection.py
│   │   │       └── dataset_repository.py
│   │   │
│   │   ├── storage/
│   │   │   ├── __init__.py
│   │   │   └── minio/
│   │   │       ├── __init__.py
│   │   │       ├── client.py
│   │   │       └── storage_service.py
│   │   │
│   │   ├── messaging/
│   │   │   ├── __init__.py
│   │   │   └── bullmq/
│   │   │       ├── __init__.py
│   │   │       ├── worker.py
│   │   │       └── handlers/
│   │   │           ├── __init__.py
│   │   │           └── transformation_handler.py
│   │   │
│   │   └── config/
│   │       ├── __init__.py
│   │       ├── settings.py
│   │       └── container.py
│   │
│   └── main.py
│
├── tests/
│   ├── __init__.py
│   ├── unit/
│   ├── integration/
│   └── conftest.py
│
├── pyproject.toml
├── ruff.toml
└── .python-version
```

### Example Files

#### `src/domain/entities/transformation_job.py`

```python
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID, uuid4


class JobStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class TransformationJob:
    dataset_id: UUID
    transformation_type: str
    parameters: dict[str, Any]
    id: UUID = field(default_factory=uuid4)
    status: JobStatus = JobStatus.PENDING
    result: dict[str, Any] | None = None
    error_message: str | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: datetime | None = None

    def mark_processing(self) -> None:
        self.status = JobStatus.PROCESSING

    def mark_completed(self, result: dict[str, Any]) -> None:
        self.status = JobStatus.COMPLETED
        self.result = result
        self.completed_at = datetime.utcnow()

    def mark_failed(self, error: str) -> None:
        self.status = JobStatus.FAILED
        self.error_message = error
        self.completed_at = datetime.utcnow()
```

#### `src/domain/ports/services/storage_service.py`

```python
from abc import ABC, abstractmethod
from typing import BinaryIO


class StorageService(ABC):
    """Port for object storage operations."""

    @abstractmethod
    async def upload(
        self,
        bucket: str,
        key: str,
        data: BinaryIO,
        content_type: str = "application/octet-stream",
    ) -> str:
        """Upload a file and return its URL."""
        ...

    @abstractmethod
    async def download(self, bucket: str, key: str) -> bytes:
        """Download a file's contents."""
        ...

    @abstractmethod
    async def delete(self, bucket: str, key: str) -> None:
        """Delete a file."""
        ...

    @abstractmethod
    async def get_presigned_url(
        self,
        bucket: str,
        key: str,
        expires_in: int = 3600,
    ) -> str:
        """Generate a presigned URL for temporary access."""
        ...
```

#### `src/application/use_cases/process_transformation.py`

```python
from dataclasses import dataclass
from typing import Any
from uuid import UUID

import polars as pl

from src.domain.entities.transformation_job import JobStatus, TransformationJob
from src.domain.ports.services.storage_service import StorageService


@dataclass
class ProcessTransformationInput:
    job_id: UUID
    dataset_id: UUID
    transformation_type: str
    parameters: dict[str, Any]
    source_file_key: str


@dataclass
class ProcessTransformationOutput:
    job_id: UUID
    status: JobStatus
    result_file_key: str | None = None
    error: str | None = None


class ProcessTransformationUseCase:
    def __init__(self, storage_service: StorageService) -> None:
        self._storage = storage_service

    async def execute(
        self,
        input_data: ProcessTransformationInput,
    ) -> ProcessTransformationOutput:
        try:
            # Download source file
            file_data = await self._storage.download(
                bucket="datasets",
                key=input_data.source_file_key,
            )

            # Process with Polars
            df = pl.read_csv(file_data)
            result_df = self._apply_transformation(
                df,
                input_data.transformation_type,
                input_data.parameters,
            )

            # Upload result
            result_key = f"results/{input_data.job_id}.parquet"
            result_bytes = result_df.write_parquet()
            await self._storage.upload(
                bucket="results",
                key=result_key,
                data=result_bytes,
                content_type="application/octet-stream",
            )

            return ProcessTransformationOutput(
                job_id=input_data.job_id,
                status=JobStatus.COMPLETED,
                result_file_key=result_key,
            )

        except Exception as e:
            return ProcessTransformationOutput(
                job_id=input_data.job_id,
                status=JobStatus.FAILED,
                error=str(e),
            )

    def _apply_transformation(
        self,
        df: pl.DataFrame,
        transformation_type: str,
        parameters: dict[str, Any],
    ) -> pl.DataFrame:
        """Apply transformation based on type. Placeholder for MVP."""
        # TODO: Implement transformation logic
        return df
```

#### `src/infrastructure/messaging/bullmq/worker.py`

```python
import asyncio
import json
from typing import Any, Callable, Coroutine

from bullmq import Worker

from src.infrastructure.config.settings import Settings


JobHandler = Callable[[dict[str, Any]], Coroutine[Any, Any, dict[str, Any]]]


class ETLWorker:
    """BullMQ worker wrapper for ETL jobs."""

    def __init__(
        self,
        settings: Settings,
        handlers: dict[str, JobHandler],
    ) -> None:
        self._settings = settings
        self._handlers = handlers
        self._worker: Worker | None = None

    async def start(self) -> None:
        """Start the worker."""
        self._worker = Worker(
            name="transformation",
            processor=self._process_job,
            opts={
                "connection": {
                    "host": self._settings.redis_host,
                    "port": self._settings.redis_port,
                },
                "concurrency": self._settings.worker_concurrency,
            },
        )
        print(f"Worker started, listening on queue: transformation")

    async def stop(self) -> None:
        """Stop the worker gracefully."""
        if self._worker:
            await self._worker.close()

    async def _process_job(self, job: Any) -> dict[str, Any]:
        """Process a single job."""
        job_type = job.name
        job_data = job.data

        handler = self._handlers.get(job_type)
        if not handler:
            raise ValueError(f"Unknown job type: {job_type}")

        return await handler(job_data)
```

#### `src/infrastructure/http/routes/health.py`

```python
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from src.infrastructure.config.container import Container


router = APIRouter()


class HealthCheck(BaseModel):
    status: str
    timestamp: str
    checks: dict[str, bool]


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    checks: dict[str, bool]


@router.get("/health", response_model=HealthResponse)
async def health_check(container: Container = Depends()) -> HealthResponse:
    """Health check endpoint."""
    from datetime import datetime

    checks = {
        "redis": await container.check_redis(),
        "minio": await container.check_minio(),
    }

    all_healthy = all(checks.values())

    return HealthResponse(
        status="ok" if all_healthy else "degraded",
        timestamp=datetime.utcnow().isoformat(),
        checks=checks,
    )
```

### Python Configuration

#### `worker/pyproject.toml`

```toml
[project]
name = "pymes-worker"
version = "0.1.0"
description = "ETL Worker for PYMES Data Strategy"
readme = "README.md"
requires-python = ">=3.12"
dependencies = [
    "fastapi==0.115.8",
    "uvicorn[standard]==0.34.0",
    "polars==1.23.0",
    "pandas==2.2.3",
    "bullmq==2.9.3",
    "boto3==1.36.20",
    "psycopg[binary]==3.2.5",
    "pydantic==2.10.6",
    "pydantic-settings==2.7.1",
    "python-dotenv==1.0.1",
    "structlog==25.1.0",
]

[project.optional-dependencies]
dev = [
    "pytest==8.3.5",
    "pytest-asyncio==0.25.3",
    "pytest-cov==6.0.0",
    "mypy==1.15.0",
    "ruff==0.9.6",
    "httpx==0.28.1",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.uv]
dev-dependencies = [
    "pytest>=8.3.5",
    "pytest-asyncio>=0.25.3",
    "pytest-cov>=6.0.0",
    "mypy>=1.15.0",
    "ruff>=0.9.6",
    "httpx>=0.28.1",
]

[tool.mypy]
python_version = "3.12"
strict = true
warn_return_any = true
warn_unused_ignores = true
disallow_untyped_defs = true
disallow_incomplete_defs = true
check_untyped_defs = true
no_implicit_optional = true
warn_redundant_casts = true

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
addopts = "-v --cov=src --cov-report=term-missing"
```

#### `worker/ruff.toml`

```toml
line-length = 100
target-version = "py312"

[lint]
select = [
    "E",      # pycodestyle errors
    "W",      # pycodestyle warnings
    "F",      # pyflakes
    "I",      # isort
    "B",      # flake8-bugbear
    "C4",     # flake8-comprehensions
    "UP",     # pyupgrade
    "ARG",    # flake8-unused-arguments
    "SIM",    # flake8-simplify
    "TCH",    # flake8-type-checking
    "PTH",    # flake8-use-pathlib
    "ERA",    # eradicate
    "RUF",    # ruff-specific
]
ignore = [
    "E501",   # line too long (handled by formatter)
]

[lint.isort]
known-first-party = ["src"]

[format]
quote-style = "double"
indent-style = "space"
```

---

## 4. Database Design

### Prisma Schema

#### `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================================
// ENUMS
// ============================================================================

enum UserRole {
  ADMIN
  USER
  VIEWER
}

enum DatasetStatus {
  PENDING      // Uploaded, awaiting processing
  PROCESSING   // Being processed by worker
  READY        // Ready for transformations
  ERROR        // Processing failed
  ARCHIVED     // Soft-deleted
}

enum JobStatus {
  QUEUED       // In queue, waiting
  PROCESSING   // Worker is processing
  COMPLETED    // Successfully completed
  FAILED       // Failed with error
  CANCELLED    // Cancelled by user
}

enum TransformationType {
  CLEAN_NULLS
  NORMALIZE
  AGGREGATE
  FILTER
  MERGE
  CUSTOM
}

// ============================================================================
// MODELS
// ============================================================================

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  role          UserRole  @default(USER)
  
  // Metadata stored as JSONB
  preferences   Json      @default("{}")
  
  // Timestamps
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")
  lastLoginAt   DateTime? @map("last_login_at")
  
  // Relations
  datasets      Dataset[]
  jobs          TransformationJob[]

  @@map("users")
}

model Dataset {
  id            String        @id @default(cuid())
  name          String
  description   String?
  status        DatasetStatus @default(PENDING)
  
  // File reference
  originalFileName String     @map("original_file_name")
  storageKey       String     @map("storage_key")
  fileSizeBytes    BigInt     @map("file_size_bytes")
  mimeType         String     @map("mime_type")
  
  // Schema information (JSONB) - inferred column types, stats
  schema        Json          @default("{}")
  
  // Dataset metadata (JSONB) - user-defined tags, source info
  metadata      Json          @default("{}")
  
  // Statistics (JSONB) - row count, column count, etc.
  statistics    Json          @default("{}")
  
  // Owner
  userId        String        @map("user_id")
  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Timestamps
  createdAt     DateTime      @default(now()) @map("created_at")
  updatedAt     DateTime      @updatedAt @map("updated_at")
  processedAt   DateTime?     @map("processed_at")
  
  // Relations
  jobs          TransformationJob[]
  
  @@index([userId])
  @@index([status])
  @@index([createdAt(sort: Desc)])
  @@map("datasets")
}

model TransformationJob {
  id                  String             @id @default(cuid())
  
  // Job definition
  transformationType  TransformationType @map("transformation_type")
  status              JobStatus          @default(QUEUED)
  priority            Int                @default(0)
  
  // Input parameters (JSONB)
  parameters          Json               @default("{}")
  
  // AI suggestions (JSONB) - for human-in-the-loop
  aiSuggestions       Json?              @map("ai_suggestions")
  
  // Output
  resultStorageKey    String?            @map("result_storage_key")
  resultMetadata      Json?              @map("result_metadata")
  
  // Error handling
  errorMessage        String?            @map("error_message")
  errorDetails        Json?              @map("error_details")
  retryCount          Int                @default(0) @map("retry_count")
  maxRetries          Int                @default(3) @map("max_retries")
  
  // BullMQ reference
  bullmqJobId         String?            @map("bullmq_job_id")
  
  // Relations
  datasetId           String             @map("dataset_id")
  dataset             Dataset            @relation(fields: [datasetId], references: [id], onDelete: Cascade)
  
  userId              String             @map("user_id")
  user                User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Timestamps
  createdAt           DateTime           @default(now()) @map("created_at")
  startedAt           DateTime?          @map("started_at")
  completedAt         DateTime?          @map("completed_at")
  
  @@index([datasetId])
  @@index([userId])
  @@index([status])
  @@index([createdAt(sort: Desc)])
  @@map("transformation_jobs")
}

// ============================================================================
// AUDIT LOG (for future compliance needs)
// ============================================================================

model AuditLog {
  id          String   @id @default(cuid())
  
  // What happened
  action      String   // CREATE, UPDATE, DELETE, etc.
  entityType  String   @map("entity_type")
  entityId    String   @map("entity_id")
  
  // Who did it
  userId      String?  @map("user_id")
  
  // Change details (JSONB)
  changes     Json     @default("{}")
  
  // Context
  ipAddress   String?  @map("ip_address")
  userAgent   String?  @map("user_agent")
  
  // When
  createdAt   DateTime @default(now()) @map("created_at")
  
  @@index([entityType, entityId])
  @@index([userId])
  @@index([createdAt(sort: Desc)])
  @@map("audit_logs")
}
```

### Migration Strategy

1. **Initial Migration**: Generate with `prisma migrate dev --name init`
2. **Migration Naming Convention**: `YYYYMMDD_description` (e.g., `20260308_init`)
3. **Production Migrations**: Use `prisma migrate deploy` (no interactive prompts)
4. **Rollback**: Keep rollback SQL scripts in `prisma/rollbacks/`

```bash
# Development workflow
pnpm prisma migrate dev --name add_feature_x

# Production deployment
pnpm prisma migrate deploy

# Generate client after schema changes
pnpm prisma generate
```

---

## 5. Messaging Design

### BullMQ Queues

| Queue Name | Producer | Consumer | Purpose |
|------------|----------|----------|---------|
| `transformation` | API Gateway | Worker ETL | ETL transformation jobs |
| `transformation-results` | Worker ETL | API Gateway | Job completion notifications |
| `dataset-processing` | API Gateway | Worker ETL | Initial dataset validation/parsing |

### Queue Configuration

#### `api/src/infrastructure/messaging/bullmq/queues.ts`

```typescript
export const QUEUE_NAMES = {
  TRANSFORMATION: 'transformation',
  TRANSFORMATION_RESULTS: 'transformation-results',
  DATASET_PROCESSING: 'dataset-processing',
} as const;

export const QUEUE_OPTIONS = {
  [QUEUE_NAMES.TRANSFORMATION]: {
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 1000 },
      attempts: 3,
      backoff: {
        type: 'exponential' as const,
        delay: 1000,
      },
    },
  },
  [QUEUE_NAMES.DATASET_PROCESSING]: {
    defaultJobOptions: {
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 500 },
      attempts: 2,
      backoff: {
        type: 'fixed' as const,
        delay: 5000,
      },
    },
  },
} as const;
```

### Message Contracts (JSON Schema)

#### Transformation Job Message

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "transformation-job",
  "type": "object",
  "required": ["jobId", "datasetId", "transformationType", "parameters", "timestamp"],
  "properties": {
    "jobId": {
      "type": "string",
      "description": "Unique job identifier (CUID)"
    },
    "datasetId": {
      "type": "string",
      "description": "Dataset to transform (CUID)"
    },
    "userId": {
      "type": "string",
      "description": "User who requested the transformation"
    },
    "transformationType": {
      "type": "string",
      "enum": ["CLEAN_NULLS", "NORMALIZE", "AGGREGATE", "FILTER", "MERGE", "CUSTOM"]
    },
    "parameters": {
      "type": "object",
      "description": "Transformation-specific parameters"
    },
    "sourceStorageKey": {
      "type": "string",
      "description": "S3/MinIO key for source file"
    },
    "priority": {
      "type": "integer",
      "default": 0,
      "description": "Job priority (higher = more urgent)"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    }
  }
}
```

#### Transformation Result Message

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "transformation-result",
  "type": "object",
  "required": ["jobId", "status", "timestamp"],
  "properties": {
    "jobId": {
      "type": "string"
    },
    "status": {
      "type": "string",
      "enum": ["COMPLETED", "FAILED"]
    },
    "resultStorageKey": {
      "type": "string",
      "description": "S3/MinIO key for result file (if completed)"
    },
    "resultMetadata": {
      "type": "object",
      "properties": {
        "rowCount": { "type": "integer" },
        "columnCount": { "type": "integer" },
        "fileSizeBytes": { "type": "integer" }
      }
    },
    "error": {
      "type": "object",
      "properties": {
        "code": { "type": "string" },
        "message": { "type": "string" },
        "details": { "type": "object" }
      }
    },
    "processingTimeMs": {
      "type": "integer"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    }
  }
}
```

### TypeScript Types (API Gateway)

```typescript
// src/infrastructure/messaging/types.ts

export interface TransformationJobMessage {
  jobId: string;
  datasetId: string;
  userId: string;
  transformationType: TransformationType;
  parameters: Record<string, unknown>;
  sourceStorageKey: string;
  priority?: number;
  timestamp: string;
}

export interface TransformationResultMessage {
  jobId: string;
  status: 'COMPLETED' | 'FAILED';
  resultStorageKey?: string;
  resultMetadata?: {
    rowCount: number;
    columnCount: number;
    fileSizeBytes: number;
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  processingTimeMs: number;
  timestamp: string;
}

export type TransformationType =
  | 'CLEAN_NULLS'
  | 'NORMALIZE'
  | 'AGGREGATE'
  | 'FILTER'
  | 'MERGE'
  | 'CUSTOM';
```

### Python Types (Worker)

```python
# src/infrastructure/messaging/types.py

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any


class TransformationType(str, Enum):
    CLEAN_NULLS = "CLEAN_NULLS"
    NORMALIZE = "NORMALIZE"
    AGGREGATE = "AGGREGATE"
    FILTER = "FILTER"
    MERGE = "MERGE"
    CUSTOM = "CUSTOM"


class JobResultStatus(str, Enum):
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


@dataclass
class TransformationJobMessage:
    job_id: str
    dataset_id: str
    user_id: str
    transformation_type: TransformationType
    parameters: dict[str, Any]
    source_storage_key: str
    timestamp: datetime
    priority: int = 0


@dataclass
class ResultMetadata:
    row_count: int
    column_count: int
    file_size_bytes: int


@dataclass
class ErrorDetails:
    code: str
    message: str
    details: dict[str, Any] | None = None


@dataclass
class TransformationResultMessage:
    job_id: str
    status: JobResultStatus
    processing_time_ms: int
    timestamp: datetime
    result_storage_key: str | None = None
    result_metadata: ResultMetadata | None = None
    error: ErrorDetails | None = None
```

---

## 6. Infrastructure Design

### Docker Compose

#### `docker-compose.yml`

```yaml
version: "3.9"

services:
  # ==========================================================================
  # REDIS - Message Broker (BullMQ)
  # ==========================================================================
  redis:
    image: redis:7.4-alpine
    container_name: pymes-redis
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # ==========================================================================
  # POSTGRESQL - Relational Database
  # ==========================================================================
  postgres:
    image: postgres:16-alpine
    container_name: pymes-postgres
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-pymes}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-pymes_dev_password}
      POSTGRES_DB: ${POSTGRES_DB:-pymes_dev}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-pymes} -d ${POSTGRES_DB:-pymes_dev}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # ==========================================================================
  # MINIO - S3-Compatible Object Storage
  # ==========================================================================
  minio:
    image: minio/minio:RELEASE.2024-02-17T01-15-57Z
    container_name: pymes-minio
    ports:
      - "${MINIO_PORT:-9000}:9000"
      - "${MINIO_CONSOLE_PORT:-9001}:9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin123}
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 30s
      timeout: 20s
      retries: 3
    restart: unless-stopped

  # ==========================================================================
  # MINIO INIT - Create Initial Buckets
  # ==========================================================================
  minio-init:
    image: minio/mc:latest
    container_name: pymes-minio-init
    depends_on:
      minio:
        condition: service_healthy
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin123}
    entrypoint: >
      /bin/sh -c "
      mc alias set myminio http://minio:9000 $${MINIO_ROOT_USER} $${MINIO_ROOT_PASSWORD};
      mc mb --ignore-existing myminio/datasets;
      mc mb --ignore-existing myminio/results;
      mc mb --ignore-existing myminio/temp;
      echo 'Buckets created successfully';
      exit 0;
      "

  # ==========================================================================
  # API GATEWAY - Node.js (Development)
  # ==========================================================================
  api:
    build:
      context: ./api
      dockerfile: Dockerfile.dev
    container_name: pymes-api
    ports:
      - "${API_PORT:-3000}:3000"
    environment:
      NODE_ENV: development
      PORT: 3000
      DATABASE_URL: postgresql://${POSTGRES_USER:-pymes}:${POSTGRES_PASSWORD:-pymes_dev_password}@postgres:5432/${POSTGRES_DB:-pymes_dev}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      MINIO_ENDPOINT: minio
      MINIO_PORT: 9000
      MINIO_ACCESS_KEY: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_SECRET_KEY: ${MINIO_ROOT_PASSWORD:-minioadmin123}
      MINIO_USE_SSL: "false"
    volumes:
      - ./api/src:/app/src:ro
      - ./prisma:/app/prisma:ro
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    restart: unless-stopped

  # ==========================================================================
  # WORKER ETL - Python (Development)
  # ==========================================================================
  worker:
    build:
      context: ./worker
      dockerfile: Dockerfile.dev
    container_name: pymes-worker
    ports:
      - "${WORKER_PORT:-8000}:8000"
    environment:
      ENVIRONMENT: development
      REDIS_HOST: redis
      REDIS_PORT: 6379
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_USER: ${POSTGRES_USER:-pymes}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-pymes_dev_password}
      POSTGRES_DB: ${POSTGRES_DB:-pymes_dev}
      MINIO_ENDPOINT: minio
      MINIO_PORT: 9000
      MINIO_ACCESS_KEY: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_SECRET_KEY: ${MINIO_ROOT_PASSWORD:-minioadmin123}
      MINIO_USE_SSL: "false"
      WORKER_CONCURRENCY: 2
    volumes:
      - ./worker/src:/app/src:ro
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    restart: unless-stopped

volumes:
  redis_data:
  postgres_data:
  minio_data:

networks:
  default:
    name: pymes-network
```

### Development Dockerfiles

#### `api/Dockerfile.dev`

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma client
RUN pnpm prisma generate

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start development server with hot reload
CMD ["pnpm", "dev"]
```

#### `worker/Dockerfile.dev`

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install uv
RUN pip install uv

# Copy dependency files
COPY pyproject.toml ./
COPY uv.lock ./

# Install dependencies
RUN uv sync --frozen

# Copy source code
COPY . .

# Expose port
EXPOSE 8000

# Start development server with hot reload
CMD ["uv", "run", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

### Environment Variables

#### `.env.example`

```bash
# =============================================================================
# PYMES Data Strategy - Environment Variables
# =============================================================================
# Copy this file to .env and fill in the values

# -----------------------------------------------------------------------------
# PostgreSQL
# -----------------------------------------------------------------------------
POSTGRES_USER=pymes
POSTGRES_PASSWORD=pymes_dev_password
POSTGRES_DB=pymes_dev
POSTGRES_PORT=5432

# Connection string for Prisma (computed from above)
DATABASE_URL=postgresql://pymes:pymes_dev_password@localhost:5432/pymes_dev

# -----------------------------------------------------------------------------
# Redis
# -----------------------------------------------------------------------------
REDIS_HOST=localhost
REDIS_PORT=6379

# -----------------------------------------------------------------------------
# MinIO (S3-compatible)
# -----------------------------------------------------------------------------
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_ENDPOINT=localhost
MINIO_USE_SSL=false

# Bucket names
MINIO_BUCKET_DATASETS=datasets
MINIO_BUCKET_RESULTS=results
MINIO_BUCKET_TEMP=temp

# -----------------------------------------------------------------------------
# API Gateway
# -----------------------------------------------------------------------------
API_PORT=3000
NODE_ENV=development

# -----------------------------------------------------------------------------
# Worker ETL
# -----------------------------------------------------------------------------
WORKER_PORT=8000
WORKER_CONCURRENCY=2
ENVIRONMENT=development

# -----------------------------------------------------------------------------
# Logging
# -----------------------------------------------------------------------------
LOG_LEVEL=debug
```

### Initialization Scripts

#### `docker/postgres/init.sql`

```sql
-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant permissions (if needed for specific users)
-- GRANT ALL PRIVILEGES ON DATABASE pymes_dev TO pymes;

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'PostgreSQL initialization complete';
END $$;
```

---

## 7. Architecture Decision Records (ADRs)

### ADR-001: Eliminar MongoDB del MVP

**Status**: ACCEPTED  
**Date**: 2026-03-08  
**Decision Makers**: Tech Lead, Backend Team

#### Context

El stack original incluía MongoDB como document store separado de PostgreSQL. Durante la fase de diseño del MVP, evaluamos si esta complejidad adicional se justifica.

#### Decision

**Usar PostgreSQL JSONB en lugar de MongoDB para el MVP.**

#### Rationale

| Factor | MongoDB | PostgreSQL JSONB |
|--------|---------|------------------|
| Complejidad operacional | Alta (2 DBs) | Baja (1 DB) |
| Curva de aprendizaje | Requiere conocer 2 sistemas | Solo PostgreSQL |
| Flexibilidad de schema | Excelente | Muy buena |
| Transacciones ACID | Limitadas | Completas |
| Queries relacionales | No aplica | Full SQL |
| Docker Compose | 2 servicios | 1 servicio |
| Backup/restore | 2 estrategias | 1 estrategia |

**Casos de uso cubiertos por JSONB:**
- `Dataset.metadata` - Tags, source info, user-defined fields
- `Dataset.schema` - Inferred column types, statistics
- `TransformationJob.parameters` - Transformation-specific config
- `TransformationJob.aiSuggestions` - AI recommendations (future)

#### Consequences

**Positivas:**
- Simplificación del stack de desarrollo
- Un solo backup strategy
- Transacciones ACID completas entre datos relacionales y JSON
- Menor tiempo de onboarding para nuevos desarrolladores

**Negativas:**
- Si necesitamos sharding o replicación compleja de documentos, PostgreSQL es menos flexible
- Full-text search en JSONB es menos potente que MongoDB

**Mitigación:**
- Si post-MVP necesitamos capacidades específicas de MongoDB, agregaremos el servicio
- La arquitectura hexagonal permite agregar un adapter MongoDB sin cambiar el dominio

---

### ADR-002: BullMQ como Sistema de Colas

**Status**: ACCEPTED  
**Date**: 2026-03-08  
**Decision Makers**: Tech Lead, Backend Team

#### Context

Necesitamos un sistema de job queues para comunicación asíncrona entre API Gateway (Node.js) y Worker ETL (Python). Evaluamos las siguientes opciones:

| Sistema | Node.js Support | Python Support | Complexity |
|---------|-----------------|----------------|------------|
| BullMQ | Nativo | bullmq (community) | Media |
| Celery | Limited | Nativo | Alta |
| RabbitMQ | amqplib | pika | Alta |
| AWS SQS | @aws-sdk/client-sqs | boto3 | Media |
| Redis Streams | ioredis | redis-py | Baja |

#### Decision

**Usar BullMQ con Redis como broker.**

#### Rationale

1. **Consistencia con stack**: Ya usamos Redis para caching futuro
2. **Excelente DX en Node.js**: BullMQ es el estándar de facto
3. **UI disponible**: Bull Board para monitoreo
4. **Features avanzados**: Retry, backoff, priorities, rate limiting
5. **Python support**: `bullmq` package (community-maintained pero funcional)

#### Spike Técnico Requerido

Antes de finalizar la implementación, validar:

```python
# Verificar que bullmq-python funciona correctamente
from bullmq import Worker

async def process(job):
    print(f"Processing {job.data}")
    return {"success": True}

worker = Worker("test-queue", process, {"connection": {"host": "localhost"}})
```

**Criterio de éxito:**
- Worker Python consume jobs creados desde Node.js
- Retry funciona correctamente
- No hay memory leaks en procesamiento continuo

#### Fallback Plan

Si BullMQ Python no funciona adecuadamente:

1. **Opción A**: Celery + Redis (Python nativo, Node.js como producer)
2. **Opción B**: HTTP polling entre servicios
3. **Opción C**: Redis Streams directamente (más trabajo, más control)

#### Consequences

**Positivas:**
- Un solo broker (Redis) para queues y futuro caching
- Código consistente entre Node.js y Python
- Buen tooling de monitoreo

**Negativas:**
- Dependencia de package Python community-maintained
- Si Redis falla, todo el sistema de queues falla

**Mitigación:**
- Redis configurado con persistencia (AOF)
- Monitoreo de Redis health
- Circuit breaker en producers

---

## 8. Cross-Service Sequence Diagrams

### Dataset Upload Flow

```
┌──────┐          ┌─────────┐          ┌───────┐          ┌────────┐          ┌───────┐
│Client│          │   API   │          │ MinIO │          │ Redis  │          │Worker │
└──┬───┘          └────┬────┘          └───┬───┘          └────┬───┘          └───┬───┘
   │                   │                   │                   │                  │
   │ POST /datasets    │                   │                   │                  │
   │ (multipart file)  │                   │                   │                  │
   │──────────────────>│                   │                   │                  │
   │                   │                   │                   │                  │
   │                   │ Upload file       │                   │                  │
   │                   │──────────────────>│                   │                  │
   │                   │                   │                   │                  │
   │                   │ Storage key       │                   │                  │
   │                   │<──────────────────│                   │                  │
   │                   │                   │                   │                  │
   │                   │ Save Dataset (PENDING)                │                  │
   │                   │───────────────────────────────────────│                  │
   │                   │                   │                   │                  │
   │                   │ Enqueue "dataset-processing"          │                  │
   │                   │──────────────────────────────────────>│                  │
   │                   │                   │                   │                  │
   │ 202 Accepted      │                   │                   │                  │
   │ {datasetId, status}                   │                   │                  │
   │<──────────────────│                   │                   │                  │
   │                   │                   │                   │ Job received     │
   │                   │                   │                   │─────────────────>│
   │                   │                   │                   │                  │
   │                   │                   │ Download file     │                  │
   │                   │                   │<─────────────────────────────────────│
   │                   │                   │                   │                  │
   │                   │                   │ File data         │                  │
   │                   │                   │─────────────────────────────────────>│
   │                   │                   │                   │                  │
   │                   │                   │                   │  Parse & validate│
   │                   │                   │                   │  (infer schema)  │
   │                   │                   │                   │                  │
   │                   │                   │                   │ Push result      │
   │                   │                   │                   │<─────────────────│
   │                   │                   │                   │                  │
   │                   │ Event: dataset-ready                  │                  │
   │                   │<──────────────────────────────────────│                  │
   │                   │                   │                   │                  │
   │                   │ Update Dataset (READY)                │                  │
   │                   │───────────────────────────────────────│                  │
   │                   │                   │                   │                  │
└──┴───┘          └────┴────┘          └───┴───┘          └────┴───┘          └───┴───┘
```

### Transformation Job Flow

```
┌──────┐          ┌─────────┐          ┌───────┐          ┌────────┐          ┌───────┐
│Client│          │   API   │          │Postgres│         │ Redis  │          │Worker │
└──┬───┘          └────┬────┘          └───┬───┘          └────┬───┘          └───┬───┘
   │                   │                   │                   │                  │
   │ POST /jobs        │                   │                   │                  │
   │ {datasetId, type} │                   │                   │                  │
   │──────────────────>│                   │                   │                  │
   │                   │                   │                   │                  │
   │                   │ Validate dataset  │                   │                  │
   │                   │──────────────────>│                   │                  │
   │                   │                   │                   │                  │
   │                   │ Dataset exists    │                   │                  │
   │                   │<──────────────────│                   │                  │
   │                   │                   │                   │                  │
   │                   │ Create Job (QUEUED)                   │                  │
   │                   │──────────────────>│                   │                  │
   │                   │                   │                   │                  │
   │                   │ Enqueue "transformation"              │                  │
   │                   │──────────────────────────────────────>│                  │
   │                   │                   │                   │                  │
   │ 202 Accepted      │                   │                   │                  │
   │ {jobId, status}   │                   │                   │                  │
   │<──────────────────│                   │                   │                  │
   │                   │                   │                   │                  │
   │                   │                   │                   │ Process job      │
   │                   │                   │                   │─────────────────>│
   │                   │                   │                   │                  │
   │                   │                   │ Update PROCESSING │                  │
   │                   │                   │<─────────────────────────────────────│
   │                   │                   │                   │                  │
   │                   │                   │                   │ ETL processing...│
   │                   │                   │                   │                  │
   │                   │                   │ Update COMPLETED  │                  │
   │                   │                   │<─────────────────────────────────────│
   │                   │                   │                   │                  │
   │                   │                   │                   │ Push result      │
   │                   │                   │                   │<─────────────────│
   │                   │                   │                   │                  │
   │ GET /jobs/{id}    │                   │                   │                  │
   │──────────────────>│                   │                   │                  │
   │                   │ Query job status  │                   │                  │
   │                   │──────────────────>│                   │                  │
   │                   │                   │                   │                  │
   │ 200 OK            │                   │                   │                  │
   │ {status: COMPLETED}                   │                   │                  │
   │<──────────────────│                   │                   │                  │
└──┴───┘          └────┴────┘          └───┴───┘          └────┴───┘          └───┴───┘
```

---

## 9. Testing Strategy (Future)

> **Note**: TDD is disabled per `openspec/config.yaml`. This section documents the planned approach.

### Unit Tests

- **API (Jest/Vitest)**: Domain entities, use cases, value objects
- **Worker (pytest)**: Domain entities, use cases, transformations

### Integration Tests

- **API**: HTTP routes with test database
- **Worker**: BullMQ handlers with test Redis

### E2E Tests

- Full flow: API -> Redis -> Worker -> PostgreSQL/MinIO
- Health check validation

---

## 10. Security Considerations

### MVP Scope (Implemented)

- Environment variables for secrets (never in code)
- Health endpoints without authentication
- Internal network isolation via Docker

### Post-MVP (Not Implemented)

- [ ] JWT authentication
- [ ] API rate limiting
- [ ] Input sanitization
- [ ] Audit logging
- [ ] HTTPS/TLS
- [ ] Secret management (Vault, AWS Secrets Manager)

---

## Appendix: File Checklist

### Root Level
- [ ] `docker-compose.yml`
- [ ] `.env.example`
- [ ] `pnpm-workspace.yaml`
- [ ] `package.json` (root)
- [ ] `README.md`

### API Gateway
- [ ] `api/package.json`
- [ ] `api/tsconfig.json`
- [ ] `api/Dockerfile.dev`
- [ ] `api/src/index.ts`
- [ ] `api/src/domain/` structure
- [ ] `api/src/application/` structure
- [ ] `api/src/infrastructure/` structure

### Worker ETL
- [ ] `worker/pyproject.toml`
- [ ] `worker/ruff.toml`
- [ ] `worker/Dockerfile.dev`
- [ ] `worker/src/main.py`
- [ ] `worker/src/domain/` structure
- [ ] `worker/src/application/` structure
- [ ] `worker/src/infrastructure/` structure

### Database
- [ ] `prisma/schema.prisma`
- [ ] `docker/postgres/init.sql`
