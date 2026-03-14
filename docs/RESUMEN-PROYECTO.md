# PymesDataStrategy — Documentación del Proyecto

**Repositorios:**
- Backend: https://github.com/jcgmU/PymesDataStrategyBackEnd.git
- Frontend: https://github.com/jcgmU/PymesDataStrategyFrontEnd.git

**Código académico:** GIIS SW-005 — Fundación Universitaria Compensar  
**Fecha de actualización:** 14 de Marzo, 2026  
**Estado:** MVP Fase 3 COMPLETO ✅ — Plataforma E2E funcional (~842 tests)

---

## 1. Introducción

### Qué problema resuelve

Las pequeñas y medianas empresas (PYMES) manejan datos críticos en archivos Excel, CSV y sistemas desconectados, con problemas recurrentes:

- **Inconsistencias**: El mismo cliente como "Juan Pérez", "J. Perez", "JUAN PEREZ S.A."
- **Datos faltantes**: Campos vacíos, teléfonos incompletos, direcciones sin formato
- **Duplicados**: Registros repetidos que complican análisis y reportes
- **Formatos mixtos**: Fechas como "01/03/2024", "1-Mar-24", "Marzo 1, 2024"

### Por qué Human-in-the-Loop (HITL)

La limpieza automática de datos puede ser peligrosa: un algoritmo podría eliminar registros importantes o hacer transformaciones incorrectas. **Human-in-the-Loop** significa que:

1. **El sistema detecta** anomalías automáticamente (nulos, tipos incorrectos, duplicados)
2. **El analista revisa** cada sugerencia en una interfaz dedicada
3. **El analista decide** aprobar, corregir o descartar cada anomalía
4. **El sistema aplica** únicamente las decisiones aprobadas

Esto combina la **velocidad del procesamiento automático** con la **precisión del criterio humano**.

### Público objetivo

PYMES que necesitan:
- Limpiar datos de Excel/CSV para análisis
- Preparar datos para Business Intelligence
- Migrar de sistemas legacy a nuevas plataformas

---

## 2. Estado del Proyecto

### Resumen de Fases

| Fase | Componente | Tests | Estado |
|------|-----------|-------|--------|
| **Fase 1** | API Gateway — Datasets, Jobs, Storage, Queue | ~337 | ✅ Completo |
| **Fase 2** | Worker ETL — Parser, Transformaciones, HITL | 308 | ✅ Completo |
| **Fase 3** | Frontend Next.js + Auth JWT + Docker E2E | 197 + E2E | ✅ Completo |

**Total: ~842 tests pasando**

### Funcionalidades implementadas

✅ **Autenticación JWT**
- Registro de nuevos usuarios (email + contraseña)
- Login con JWT firmado por el backend
- NextAuth v5 en el frontend (credentials provider)
- Sesión persistente y logout
- Middleware de protección de rutas en frontend y backend

✅ **Gestión de Datasets (aislamiento por usuario)**
- Subida de archivos CSV, Excel (hasta 10MB en frontend, 100MB en API)
- Cada usuario solo ve y accede a sus propios datasets (filtrado por JWT)
- CRUD completo: listar, ver detalle, eliminar

✅ **Sistema de Trabajos ETL**
- Cola asíncrona Node.js ↔ Python vía BullMQ + Redis
- Estados: QUEUED → PROCESSING → COMPLETED / FAILED
- Streaming de estado en tiempo real via **Server-Sent Events (SSE)**

✅ **Procesamiento ETL (Worker Python)**
- Parser universal para CSV y Excel
- 6 tipos de transformaciones: imputación de nulos, eliminación de outliers, normalización de tipos, deduplicación, formato de fechas, escalado
- Detección automática de anomalías para revisión HITL

✅ **Human-in-the-Loop (HITL)**
- Detección automática de anomalías en datasets
- Interfaz de revisión: el analista aprueba, corrige o descarta cada anomalía
- Decisiones persistidas en base de datos (tablas `anomalies` + `decisions`)

✅ **Dashboard de Analítica**
- Métricas del sistema: total datasets, jobs completados, jobs fallidos, revisiones pendientes
- Visualización con Recharts

✅ **Swagger / OpenAPI**
- Documentación interactiva en `http://localhost:3000/api/docs`
- 17 endpoints documentados

✅ **Stack Docker E2E**
- 7 servicios orquestados con `docker-compose.yml`
- Hot-reload en desarrollo (volúmenes montados)
- Health checks en todos los servicios

---

## 3. Arquitectura del Sistema

### Visión general

```
┌───────────────────────────────────────────────────────────────────┐
│                         PYMES Platform                            │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐   NextAuth v5   ┌──────────────────┐           │
│  │  Frontend    │──────────────▶ │   API Gateway    │           │
│  │ (Next.js 15) │  Bearer JWT    │  (Node.js/Express│           │
│  │   :3001      │◀────────────── │   :3000          │           │
│  └──────────────┘                └────────┬─────────┘           │
│                                           │ BullMQ              │
│                                    ┌──────▼──────┐              │
│                                    │ Worker ETL  │              │
│                                    │  (Python)   │              │
│                                    │   :8000     │              │
│                                    └──────┬──────┘              │
│                                           │                     │
│   ┌─────────────┐   ┌─────────────┐   ┌──┴──────────┐          │
│   │ PostgreSQL  │   │    Redis    │   │    MinIO    │          │
│   │   :5432     │   │   :6379     │   │ :9000/:9001 │          │
│   └─────────────┘   └─────────────┘   └─────────────┘          │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

### Flujo de autenticación

```
[Login Form] → NextAuth Credentials.authorize()
             → POST /api/v1/auth/login (Express)
             → { success: true, data: { user, accessToken } }
             → NextAuth jwt callback guarda accessToken
             → api-client.ts lee session.accessToken
             → Authorization: Bearer <JWT>
             → AuthMiddleware valida JWT → req.userId disponible
```

### Flujo ETL + HITL

```
1. Usuario sube CSV/Excel    →  POST /api/v1/datasets
2. API guarda en MinIO       →  storage key en PostgreSQL
3. API encola job en Redis   →  BullMQ queue
4. Worker toma el job        →  parsea y detecta anomalías
5. Worker guarda anomalías   →  tabla `anomalies` en PostgreSQL
6. Job → AWAITING_REVIEW     →  usuario recibe notificación
7. Usuario revisa anomalías  →  GET /api/v1/datasets/:id/anomalies
8. Usuario envía decisiones  →  POST /api/v1/datasets/:id/decisions
9. Worker aplica decisiones  →  job avanza a COMPLETED
10. Dataset listo             →  disponible en MinIO
```

### Arquitectura Hexagonal (ambos servicios)

```
src/
├── domain/          ← Lógica de negocio pura (sin imports externos)
│   ├── entities/    ← User, Dataset, TransformationJob, Anomaly
│   ├── value-objects/
│   ├── ports/       ← Interfaces (Repository, Storage, Queue)
│   └── errors/
├── application/     ← Casos de uso y DTOs
│   └── use-cases/   ← RegisterUseCase, LoginUseCase, CreateDatasetUseCase…
└── infrastructure/  ← Adaptadores (HTTP, DB, Storage, Queue)
    ├── http/        ← Controllers, routes, middleware
    ├── persistence/ ← Prisma repositories
    └── messaging/   ← BullMQ producer/consumer
```

---

## 4. Stack Tecnológico

### API Gateway (Node.js)

| Tecnología | Versión | Uso |
|---|---|---|
| Express | 4.21 | Framework web |
| TypeScript | 5.7 | Tipado estático |
| Prisma | 6.4 | ORM + migraciones |
| BullMQ | 5.34 | Productor de cola |
| Zod | 3.24 | Validación de esquemas |
| bcryptjs | — | Hash de contraseñas |
| jsonwebtoken | — | Firma y verificación JWT |
| swagger-ui-express | — | Documentación OpenAPI |
| Vitest | — | ~337 tests unitarios/integración |

### Worker ETL (Python)

| Tecnología | Versión | Uso |
|---|---|---|
| FastAPI | 0.115 | Framework web |
| Polars | 1.23 | Procesamiento de datos de alto rendimiento |
| Pandas | 2.2 | Manipulación de datos (fallback) |
| BullMQ | 2.9 | Consumer de cola (binding Python) |
| Pydantic | 2.10 | Configuración y validación |
| pytest | — | 308 tests |

### Frontend (Next.js)

| Tecnología | Versión | Uso |
|---|---|---|
| Next.js | 15 (App Router) | Framework React |
| React | 19 | UI Library |
| TypeScript | Estricto | Tipado estático |
| Tailwind CSS | v4 | Estilos CSS-first |
| Zustand | v5 | Estado global |
| React Query | v5 | Data fetching y caché |
| NextAuth | v5 (beta) | Autenticación |
| Zod | v4 | Validación de esquemas |
| Recharts | v3 | Gráficos del dashboard |
| Sonner | v2 | Toast notifications |
| Vitest | v4 | 197 unit tests |
| Playwright | — | 4 specs E2E |

### Infraestructura

| Servicio | Versión | Puerto | Uso |
|---|---|---|---|
| PostgreSQL | 15 | 5432 | Base de datos relacional |
| Redis | 7 | 6379 | Broker de mensajes BullMQ |
| MinIO | Latest | 9000/9001 | Almacenamiento de objetos (S3-compatible) |
| Docker Compose | — | — | Orquestación de 7 servicios |

---

## 5. Modelo de Datos

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│      User       │     │    Dataset       │     │  TransformationJob   │
├─────────────────┤     ├──────────────────┤     ├──────────────────────┤
│ id: cuid        │────▶│ id: cuid         │────▶│ id: cuid             │
│ email: unique   │     │ name: string     │     │ type: enum           │
│ password: hash  │     │ description?     │     │ status: enum         │
│ name: string?   │     │ status: enum     │     │ parameters: json     │
│ role: enum      │     │ storageKey       │     │ resultStorageKey?    │
│ createdAt       │     │ fileSizeBytes    │     │ errorMessage?        │
│ updatedAt       │     │ mimeType         │     │ bullmqJobId?         │
└─────────────────┘     │ schema: json     │     │ createdAt            │
                        │ statistics: json │     └──────────────────────┘
                        │ userId (FK)      │
                        │ createdAt        │
                        └──────────────────┘
                                │
                    ┌───────────┴────────────┐
                    │                        │
           ┌────────▼────────┐    ┌──────────▼──────────┐
           │    Anomaly      │    │      Decision       │
           ├─────────────────┤    ├─────────────────────┤
           │ id: cuid        │    │ id: cuid            │
           │ datasetId (FK)  │    │ anomalyId (FK)      │
           │ column: string  │    │ userId (FK)         │
           │ type: enum      │    │ action: enum        │
           │ description     │    │ correction?         │
           │ status: enum    │    │ createdAt           │
           │ createdAt       │    └─────────────────────┘
           └─────────────────┘
```

### Estados

**Dataset Status:** `PENDING` → `PROCESSING` → `READY` / `ERROR` / `ARCHIVED`

**Job Status:** `QUEUED` → `PROCESSING` → `COMPLETED` / `FAILED` / `CANCELLED` / `AWAITING_REVIEW`

**Anomaly Status:** `PENDING` → `APPROVED` / `REJECTED` / `CORRECTED`

---

## 6. API REST — 17 Endpoints

Base: `/api/v1` — Docs: `http://localhost:3000/api/docs`

### Autenticación (4 endpoints — público)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/auth/register` | Registrar nuevo usuario |
| POST | `/auth/login` | Login — retorna JWT |
| GET | `/auth/me` | Usuario autenticado (requiere JWT) |
| POST | `/auth/logout` | Cerrar sesión |

### Datasets (5 endpoints — requieren JWT)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/datasets` | Subir CSV/Excel a MinIO |
| GET | `/datasets` | Listar datasets **del usuario autenticado** |
| GET | `/datasets/:id` | Obtener dataset por ID |
| DELETE | `/datasets/:id` | Eliminar dataset |
| POST | `/datasets/:id/transform` | Iniciar transformación ETL |

> **Nota de seguridad:** `GET /datasets` filtra por el `userId` del JWT — nunca acepta `?userId=` como query param.

### Jobs ETL (4 endpoints — requieren JWT)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/jobs` | Listar jobs del usuario |
| GET | `/jobs/:id` | Estado de un job |
| GET | `/jobs/:id/events` | Stream SSE de estado en tiempo real |
| GET | `/datasets/:id/download` | URL de descarga del resultado |

### HITL — Anomalías y Decisiones (2 endpoints — requieren JWT)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/datasets/:id/anomalies` | Obtener anomalías detectadas |
| POST | `/datasets/:id/decisions` | Enviar decisiones humanas |

### Estadísticas (1 endpoint — requiere JWT)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/stats` | Métricas globales del dashboard |

### Health (1 endpoint — público)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/health` | Estado de API, BD, Redis, MinIO |

---

## 7. Servicios Docker

```bash
make up    # Levanta los 7 servicios desde backend/
make ps    # Ver estado de todos los servicios
make logs  # Logs en tiempo real
make down  # Detener todos los servicios
```

| Servicio | URL | Descripción |
|---|---|---|
| `pymes-frontend` | http://localhost:3001 | Next.js 15 + NextAuth v5 |
| `pymes-api` | http://localhost:3000 | API Gateway (Express) |
| `pymes-api` docs | http://localhost:3000/api/docs | Swagger UI |
| `pymes-worker` | http://localhost:8000 | Worker ETL (FastAPI) |
| `pymes-minio` | http://localhost:9001 | Consola MinIO |
| `pymes-postgres` | localhost:5432 | PostgreSQL 15 |
| `pymes-redis` | localhost:6379 | Redis 7 |

---

## 8. Cómo Ejecutar el Proyecto

### Requisitos

- Docker y Docker Compose instalados
- Node.js 20+ y pnpm (para desarrollo local)
- Python 3.12+ con uv (para desarrollo local)

### Inicio rápido

```bash
# 1. Clonar repositorios
git clone https://github.com/jcgmU/PymesDataStrategyBackEnd.git
git clone https://github.com/jcgmU/PymesDataStrategyFrontEnd.git

# 2. Configurar variables de entorno
cd PymesDataStrategyBackEnd
cp .env.example .env

# 3. Levantar todo el stack
make up

# 4. Verificar que todo está healthy
make ps

# 5. Abrir la aplicación
open http://localhost:3001
```

### Credenciales por defecto (desarrollo)

| Campo | Valor |
|---|---|
| Email | `demo@pymes.com` |
| Contraseña | `Demo1234!` |

---

## 9. Cómo Ejecutar Tests

```bash
# API Gateway (~337 tests, Vitest)
cd backend && make test-api

# Worker ETL (308 tests, pytest)
cd backend && make test-worker

# Frontend (197 unit tests, Vitest)
cd frontend && pnpm test

# Frontend E2E (4 specs, Playwright — requiere stack corriendo)
cd frontend && pnpm test:e2e
```

| Componente | Tests | Cobertura |
|---|---|---|
| API Gateway | ~337 | ~90% |
| Worker ETL | 308 | ~88% |
| Frontend Unit | 197 | — |
| Frontend E2E | 4 specs | — |
| **Total** | **~842** | — |

---

## 10. Transformaciones ETL Disponibles

El Worker ETL implementa **6 transformaciones** usando Polars:

| Transformación | Descripción |
|---|---|
| **Imputación de nulos** | Rellena valores faltantes con media, mediana o valor fijo |
| **Eliminación de outliers** | Detecta y elimina valores estadísticamente atípicos |
| **Normalización de tipos** | Convierte columnas al tipo correcto (string→date, etc.) |
| **Deduplicación** | Elimina registros duplicados por columnas seleccionadas |
| **Formato de fechas** | Estandariza distintos formatos de fecha |
| **Escalado** | Normaliza rangos numéricos (min-max, z-score) |

---

## 11. Decisiones de Arquitectura

### ADR-001: PostgreSQL + JSONB sobre MongoDB

Consistencia ACID para operaciones críticas + JSONB para campos semi-estructurados (metadata, statistics, schema). Un solo motor simplifica deployment.

### ADR-002: BullMQ para mensajería Node.js ↔ Python

Librería con soporte nativo en Node.js y binding Python. Features avanzadas (retry, priority, cron). Redis como broker único para cola y caché.

### ADR-003: Arquitectura Hexagonal en ambos servicios

Dominio aislado (sin dependencias externas) → altamente testeable. Cambiar Express por Fastify no afecta la lógica de negocio.

### ADR-004: NextAuth v5 + JWT propio del backend

NextAuth maneja la sesión del browser. El backend firma sus propios JWT. `authorize()` en NextAuth llama al backend; el accessToken se almacena en la sesión de NextAuth y se envía en cada request como `Authorization: Bearer`.

### ADR-005: SSE sobre WebSockets para estado de jobs

Streaming unidireccional (servidor → cliente) es suficiente para reportar progreso de jobs. SSE es más simple que WebSockets y compatible con proxies HTTP estándar.

### ADR-006: `userId` del JWT — nunca del query string

El endpoint `GET /datasets` utiliza **exclusivamente** `req.userId` (inyectado por el AuthMiddleware a partir del JWT) para filtrar datasets. El parámetro `?userId=` ha sido eliminado para evitar acceso cruzado a datos de otros usuarios.

---

## 12. Estructura del Proyecto

```
backend/                          # Monorepo backend + docker-compose
├── api/                          # API Gateway (Node.js + TypeScript)
│   ├── src/
│   │   ├── domain/               # Entidades, value objects, puertos
│   │   ├── application/          # Use cases (Register, Login, CreateDataset…)
│   │   └── infrastructure/       # HTTP, Prisma, MinIO, BullMQ
│   └── package.json
├── worker/                       # Worker ETL (Python)
│   ├── src/
│   │   ├── domain/
│   │   ├── application/          # Transformaciones, parsers, processor
│   │   └── infrastructure/       # FastAPI, MinIO, BullMQ consumer
│   └── pyproject.toml
├── prisma/                       # Schema + migraciones (2 aplicadas)
├── docker/                       # Dockerfiles por servicio
├── docs/                         # Este documento
├── openspec/                     # Artefactos SDD
├── docker-compose.yml            # 7 servicios orquestados
└── Makefile

frontend/                         # Next.js 15 App Router
├── app/
│   ├── (auth)/login/             # Página de login
│   ├── dashboard/                # Dashboard, datasets, review HITL
│   └── api/auth/                 # Handlers NextAuth
├── components/features/          # FileDropzone, DatasetsTable, AnomalyCard…
├── hooks/
│   ├── api/                      # useDatasets, useAnomalies, useJobStatus
│   │   └── (todos leen token de useSession() internamente)
│   ├── useJobPoller.ts           # Wrapper sobre useJobSSE
│   └── useJobSSE.ts              # Server-Sent Events client
├── lib/
│   ├── api-client.ts             # HTTP client (Bearer token automático)
│   └── api-endpoints.ts          # Constantes de URLs
├── store/                        # Zustand stores
├── auth.ts                       # NextAuth config (INTERNAL_API_URL)
└── middleware.ts                  # Protección de rutas
```

---

## 13. Glosario

**BullMQ:** Librería para colas de trabajos basada en Redis. Funciona en Node.js y Python.

**CUID:** Collision-resistant Unique Identifier. ID legible y URL-safe.

**Dataset:** Archivo CSV/Excel cargado por el usuario con sus metadatos.

**ETL:** Extract, Transform, Load. Proceso de extraer, transformar y cargar datos.

**HITL (Human-in-the-Loop):** El humano revisa y aprueba las sugerencias del sistema antes de aplicarlas.

**JWT:** JSON Web Token. Token firmado que identifica al usuario en cada request.

**MinIO:** Servidor de almacenamiento compatible con Amazon S3.

**NextAuth v5:** Librería de autenticación para Next.js. Gestiona la sesión del browser.

**Polars:** Librería Python para procesamiento de datos hasta 10x más rápida que Pandas.

**Prisma:** ORM moderno que genera tipos TypeScript desde el schema de base de datos.

**PYMES:** Pequeñas Y Medianas Empresas.

**SDD:** Spec-Driven Development. Metodología de especificaciones antes de código.

**SSE (Server-Sent Events):** Streaming unidireccional del servidor al cliente para actualizaciones en tiempo real.

---

## Contacto y Recursos

- **Backend:** https://github.com/jcgmU/PymesDataStrategyBackEnd.git
- **Frontend:** https://github.com/jcgmU/PymesDataStrategyFrontEnd.git
- **Swagger UI:** `http://localhost:3000/api/docs` (requiere stack activo)
- **Especificaciones SDD:** `backend/openspec/` directory
- **Total tests:** ~842 pasando

**MVP Fase 3 completado** — Plataforma ETL + HITL funcional, E2E en Docker, autenticación JWT completa.
