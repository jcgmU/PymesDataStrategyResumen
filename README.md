# PymesDataStrategyBackEnd

Sistema ETL con Human-in-the-Loop para limpieza de datos asistida por IA, orientado a PyMEs (Bogotá).

**Repositorio:** https://github.com/jcgmU/PymesDataStrategyBackEnd.git  
**Código académico:** GIIS SW-005

**Estado: Fase 3 COMPLETA** — ~842 tests pasando (API: ~337, Worker: 308, Frontend: 197 + 4 E2E)

## Arquitectura

```
┌──────────────────────────────────────────────────────────────────────┐
│                          PYMES Platform                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐   NextAuth v5   ┌──────────────┐                  │
│  │  Frontend    │────────────────▶│ API Gateway  │                  │
│  │  (Next.js)   │                 │  (Node.js)   │                  │
│  │   :3001      │                 │   :3000      │                  │
│  └──────────────┘                 └──────┬───────┘                  │
│                                          │ BullMQ                   │
│                                   ┌──────▼───────┐                  │
│                                   │ Worker ETL   │                  │
│                                   │  (Python)    │                  │
│                                   │   :8000      │                  │
│                                   └──────┬───────┘                  │
│                                          │                          │
│          ┌───────────────┐    ┌──────────┴──────┐   ┌───────────┐  │
│          │  PostgreSQL   │    │     MinIO        │   │   Redis   │  │
│          │    :5432      │    │  :9000 / :9001   │   │   :6379   │  │
│          └───────────────┘    └─────────────────┘   └───────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Stack Tecnológico

### API Gateway (Node.js)
- **Express 4.21** — Framework web
- **TypeScript 5.7** — Tipado estático, arquitectura hexagonal
- **Prisma 6** — ORM + migraciones (`prisma/migrations/` — 2 migraciones aplicadas)
- **BullMQ 5.34** — Productor de cola de trabajos
- **Zod 3.24** — Validación de esquemas
- **Vitest** — ~337 tests unitarios/integración

### Worker ETL (Python)
- **FastAPI 0.115** — Framework web
- **Polars 1.23** — Procesamiento de datos de alto rendimiento
- **Pandas 2.2** — Manipulación de datos
- **BullMQ 2.9** — Consumidor de cola (binding Python)
- **Pydantic 2.10** — Configuración y validación
- **pytest** — 308 tests

### Frontend
- **Next.js 15** + **NextAuth v5** — App Router, autenticación
- **Recharts** — Dashboard de analíticas
- **Vitest** — 197 tests + 4 specs E2E con Playwright

### Infraestructura
- **PostgreSQL 15** — Base de datos relacional
- **Redis 7** — Broker de mensajes (BullMQ)
- **MinIO** — Almacenamiento de objetos compatible con S3
- **Docker Compose** — 7 servicios orquestados

## Funcionalidades Implementadas

- **Autenticación JWT** — NextAuth v5 + Express JWT (registro, login, logout, sesión)
- **Gestión de Datasets** — Subida CSV/Excel a MinIO, CRUD completo
- **Transformaciones ETL** — 6 tipos: imputación de nulos, eliminación de outliers, normalización de tipos, deduplicación, formato de fechas, escalado
- **Human-in-the-Loop (HITL)** — Detección de anomalías → revisión humana → decisión aplicada
- **Streaming SSE** — Estado de jobs en tiempo real (`GET /jobs/:id/stream`)
- **Dashboard de analíticas** — Endpoint de stats + visualización con Recharts
- **Swagger / OpenAPI** — Documentación interactiva en `http://localhost:3000/api/docs`
- **Stack Docker E2E** — Todos los servicios orquestados con `docker-compose.yml`
- **Migraciones Prisma** — 2 migraciones aplicadas (tablas `anomalies` + `decisions`)

## Inicio Rápido

```bash
# Iniciar todos los servicios (desde backend/)
make up

# Ver logs en tiempo real
make logs

# Ver estado de los servicios
make ps

# Detener todos los servicios
make down
```

### Ejecutar tests

```bash
# API Gateway (~337 tests, Vitest)
make test-api

# Worker ETL (308 tests, pytest)
make test-worker

# Con cobertura (manual)
cd api && pnpm test:coverage
cd worker && uv run pytest --cov=src --cov-report=html
```

## Servicios Docker

| Servicio            | URL                           | Descripción                   |
|---------------------|-------------------------------|-------------------------------|
| `pymes-frontend`    | http://localhost:3001         | Next.js 15 + NextAuth v5      |
| `pymes-api`         | http://localhost:3000         | API Gateway (Express)         |
| `pymes-worker`      | http://localhost:8000         | Worker ETL (FastAPI)          |
| `pymes-minio`       | http://localhost:9001         | Consola MinIO                 |
| `pymes-postgres`    | localhost:5432                | PostgreSQL 15                 |
| `pymes-redis`       | localhost:6379                | Redis 7                       |
| `pymes-minio-init`  | —                             | Inicializador de buckets (one-shot) |

## Endpoints Disponibles

Prefijo base: `/api/v1` — Documentación interactiva: `http://localhost:3000/api/docs`

### Autenticación (4 endpoints)

| Método | Endpoint             | Descripción                    |
|--------|----------------------|--------------------------------|
| POST   | `/auth/register`     | Registrar nuevo usuario        |
| POST   | `/auth/login`        | Iniciar sesión, retorna JWT    |
| GET    | `/auth/me`           | Obtener usuario autenticado    |
| POST   | `/auth/logout`       | Cerrar sesión                  |

### Datasets (4 endpoints)

| Método | Endpoint             | Descripción                                          |
|--------|----------------------|------------------------------------------------------|
| POST   | `/datasets`          | Subir CSV/Excel a MinIO (multipart/form-data)        |
| GET    | `/datasets`          | Listar datasets del usuario autenticado (JWT)        |
| GET    | `/datasets/:id`      | Obtener dataset por ID                               |
| DELETE | `/datasets/:id`      | Eliminar dataset                                     |

> **Nota:** `GET /datasets` filtra automáticamente por el usuario del JWT. No acepta `?userId=` como parámetro externo (se ignora por seguridad).

### Jobs ETL (4 endpoints)

| Método | Endpoint               | Descripción                          |
|--------|------------------------|--------------------------------------|
| POST   | `/jobs`                | Crear y encolar job ETL              |
| GET    | `/jobs`                | Listar jobs del usuario              |
| GET    | `/jobs/:id`            | Obtener estado de un job             |
| GET    | `/jobs/:id/stream`     | Stream SSE de estado en tiempo real  |

### Human-in-the-Loop / Decisiones (2 endpoints)

| Método | Endpoint                  | Descripción                              |
|--------|---------------------------|------------------------------------------|
| GET    | `/jobs/:id/anomalies`     | Obtener anomalías detectadas del job     |
| POST   | `/jobs/:id/decisions`     | Enviar decisiones humanas sobre anomalías|

### Estadísticas (1 endpoint)

| Método | Endpoint   | Descripción                              |
|--------|------------|------------------------------------------|
| GET    | `/stats`   | Métricas globales de uso (dashboard)     |

### Health (2 endpoints)

| Método | Endpoint           | Descripción                       |
|--------|--------------------|-----------------------------------|
| GET    | `/health`          | Health check básico               |
| GET    | `/health/detailed` | Health check con estado de dependencias |

## Flujo Human-in-the-Loop (HITL)

```
1. Usuario crea un job ETL   →  POST /api/v1/jobs
2. Worker procesa el dataset →  detecta anomalías automáticamente
3. Job queda en estado       →  AWAITING_REVIEW
4. Usuario consulta anomalías→  GET /api/v1/jobs/:id/anomalies
5. Usuario revisa y decide   →  POST /api/v1/jobs/:id/decisions
6. Worker aplica decisiones  →  job avanza a COMPLETED
7. Resultado disponible      →  en MinIO (descarga directa)
```

El estado del job puede seguirse en tiempo real via SSE: `GET /api/v1/jobs/:id/stream`.

## Health Checks

```bash
# API Gateway
curl http://localhost:3000/health
curl http://localhost:3000/health/detailed

# Worker ETL
curl http://localhost:8000/health
```

## Desarrollo Local (sin Docker)

```bash
# Iniciar solo infraestructura (postgres, redis, minio)
make up

# Ejecutar API localmente
make api-dev

# Ejecutar Worker localmente (requiere uv)
make worker-dev
```

## Base de Datos

```bash
# Ejecutar migraciones (ya aplicadas: anomalies + decisions)
make db-migrate

# Abrir Prisma Studio
make db-studio

# Resetear base de datos (ADVERTENCIA: pérdida de datos)
make db-reset
```

## Utilidades

```bash
make psql        # CLI de PostgreSQL
make redis-cli   # CLI de Redis
make install     # Instalar dependencias
make lint        # Lint del código
make typecheck   # Verificar tipos TypeScript
make clean       # Eliminar contenedores y volúmenes
```

## Estructura del Proyecto

```
backend/
├── api/                      # API Gateway (Node.js + TypeScript)
│   └── src/
│       ├── domain/           # Lógica de negocio (núcleo hexagonal)
│       │   ├── entities/
│       │   ├── value-objects/
│       │   ├── ports/
│       │   └── errors/
│       ├── application/      # Casos de uso y DTOs
│       └── infrastructure/   # Adaptadores (HTTP, BD, Cola)
│           ├── config/
│           ├── http/
│           │   ├── controllers/
│           │   ├── middleware/
│           │   └── routes/
│           └── persistence/
├── worker/                   # Worker ETL (Python + FastAPI)
│   └── src/
│       ├── domain/           # Lógica de negocio (núcleo hexagonal)
│       ├── application/      # Casos de uso y DTOs
│       └── infrastructure/   # Adaptadores (HTTP, Almacenamiento, Cola)
├── prisma/                   # Esquema Prisma + migraciones
│   └── migrations/           # 2 migraciones aplicadas (anomalies, decisions)
├── docker/                   # Configuraciones Docker por servicio
├── docs/                     # Documentación del proyecto
├── openspec/                 # Artefactos SDD (propuestas, specs, diseños)
├── docker-compose.yml        # Orquestación de 7 servicios
├── Makefile                  # Comandos de desarrollo
└── README.md                 # Este archivo
```

## Variables de Entorno

Copiar `.env.example` a `.env`:

```bash
cp .env.example .env
```

Variables principales:

| Variable          | Descripción                          |
|-------------------|--------------------------------------|
| `DATABASE_URL`    | Conexión PostgreSQL (Prisma)         |
| `REDIS_URL`       | Conexión Redis (BullMQ)              |
| `MINIO_*`         | Credenciales y endpoint MinIO        |
| `JWT_SECRET`      | Secreto para firma de tokens JWT     |
| `NEXTAUTH_SECRET` | Secreto para NextAuth v5             |
| `API_PORT`        | Puerto del API Gateway (default 3000)|
| `WORKER_PORT`     | Puerto del Worker ETL (default 8000) |

Ver `.env.example` para la lista completa.

## Decisiones de Arquitectura

Ver `openspec/` para documentos de diseño completos. Decisiones clave:

1. **ADR-001: PostgreSQL + JSONB sobre MongoDB** — Stack simplificado; JSONB cubre necesidades documentales
2. **ADR-002: BullMQ para mensajería** — Funciona tanto en Node.js como en Python
3. **Arquitectura Hexagonal** — Separación limpia entre dominio, aplicación e infraestructura en ambos servicios
4. **NextAuth v5 + JWT** — Autenticación unificada entre frontend y API
5. **SSE sobre WebSockets** — Streaming unidireccional suficiente para estado de jobs; menor complejidad

## Solución de Problemas

### Conflictos de puertos
Los puertos por defecto son 5432, 6379, 3000, 8000, 3001. Ajustar en `.env` si hay conflictos locales.

### Problemas con Docker
```bash
# Eliminar todos los contenedores y volúmenes
make clean

# Reconstruir imágenes sin caché
docker compose build --no-cache
```

### Problemas con Prisma
```bash
# Regenerar cliente Prisma
make db-generate

# Ver estado actual de la BD
make db-studio
```

## Documentación Adicional

- **Documentación completa del proyecto:** `docs/RESUMEN-PROYECTO.md`
- **Especificaciones técnicas:** `openspec/` directory
- **Swagger UI (requiere servicios activos):** `http://localhost:3000/api/docs`
- **Decisiones de arquitectura:** ADRs en `openspec/`

## Licencia

MIT
