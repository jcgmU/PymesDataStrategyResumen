# Proposal: scaffolding-backend-mvp

**Status**: DRAFT  
**Created**: 2026-03-08  
**Author**: OpenCode Agent

---

## Intent

Establecer la estructura inicial completa del backend ETL para PYMES Data Strategy, creando un foundation sólido y funcional que permita desarrollo paralelo del API Gateway (Node.js) y Worker ETL (Python).

Este scaffolding es crítico porque:

1. **Desbloquea desarrollo paralelo**: Con la estructura base, equipos pueden trabajar en api/ y worker/ simultáneamente
2. **Establece patrones arquitectónicos**: Hexagonal architecture desde el día 1 evita refactors costosos
3. **Ambiente local reproducible**: Docker Compose garantiza paridad entre desarrolladores
4. **Validación temprana de stack**: Confirma que BullMQ + Python funciona antes de invertir más

### Decisión Arquitectónica: Eliminar MongoDB para MVP

**DECISIÓN**: Usar PostgreSQL + JSONB en lugar de MongoDB para el MVP.

**Rationale**:
- Reduce complejidad operacional (un solo motor de base de datos)
- PostgreSQL JSONB cubre casos de schema flexible para metadata de datasets
- Simplifica Docker Compose y deployment inicial
- MongoDB puede agregarse post-MVP si hay necesidad real de document store

---

## Scope

### Módulos Afectados

| Módulo | Impacto | Descripción |
|--------|---------|-------------|
| `/api` | **NUEVO** | API Gateway Node.js completo |
| `/worker` | **NUEVO** | Worker ETL Python completo |
| `/docker` | **NUEVO** | Docker Compose y configs |
| `/prisma` | **NUEVO** | Schemas y migraciones |
| Raíz | **MODIFICADO** | package.json, pnpm-workspace.yaml |

### Servicios de Infraestructura

- **Redis**: Job queue broker (BullMQ)
- **PostgreSQL**: Persistencia relacional + JSONB
- **MinIO**: Almacenamiento S3-compatible para archivos

### Fuera de Scope de Servicios

- MongoDB (eliminado del MVP por decisión arquitectónica)
- Servicios de AI/ML
- CDN o almacenamiento externo

---

## Approach

### Fase 1: Infraestructura Base (Docker)

1. Crear `docker-compose.yml` con Redis, PostgreSQL, MinIO
2. Configurar volúmenes persistentes para desarrollo
3. Agregar scripts de inicialización (crear buckets MinIO, etc.)
4. Documentar variables de entorno en `.env.example`

### Fase 2: API Gateway (Node.js)

1. Inicializar monorepo con pnpm workspaces
2. Crear `/api` con Express + TypeScript
3. Implementar arquitectura hexagonal:
   - `domain/` - Entidades y puertos
   - `application/` - Use cases
   - `infrastructure/` - Adapters (HTTP, Prisma, BullMQ)
4. Configurar Prisma con schemas: User, Dataset, TransformationLog
5. Implementar endpoint `GET /health` funcional
6. Setup de linting (ESLint) y formato (Prettier)

### Fase 3: Worker ETL (Python)

1. Crear `/worker` con estructura uv/pyproject.toml
2. Implementar arquitectura hexagonal:
   - `domain/` - Entidades y puertos
   - `application/` - Use cases
   - `infrastructure/` - Adapters (BullMQ, S3, PostgreSQL)
3. **Spike técnico**: Validar BullMQ con Python (bullmq-python o alternativa)
4. Implementar endpoint `GET /health` con FastAPI
5. Setup de linting (ruff) y formato (black)

### Fase 4: Integración

1. Verificar conectividad api <-> Redis <-> worker
2. Test de health check end-to-end
3. Documentar setup de desarrollo en README.md

---

## Out of Scope

Este cambio **NO** incluye:

- [ ] Autenticación/autorización (JWT, OAuth)
- [ ] Upload de archivos a S3/MinIO
- [ ] Procesamiento ETL real (transformaciones)
- [ ] Integración con AI para sugerencias
- [ ] UI/Frontend
- [ ] CI/CD pipelines
- [ ] Deployment a producción
- [ ] Tests automatizados (TDD deshabilitado según config)
- [ ] MongoDB (eliminado del MVP)

---

## Risks

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| **BullMQ Python no funciona** | Media | Alto | Spike técnico en Fase 3. Alternativas: Celery, arq, dramatiq |
| **Conflictos pnpm + uv** | Baja | Medio | Separación clara de workspaces, scripts independientes |
| **MinIO incompatible con SDK S3** | Baja | Medio | Usar boto3 con endpoint_url configurable |
| **Prisma migrations complejas** | Baja | Bajo | Schemas simples para MVP, iteración posterior |

### Riesgo Crítico: BullMQ Python

**Acción requerida**: Antes de completar Fase 3, ejecutar spike técnico:

```bash
# Validar que bullmq-python funciona con nuestro Redis
uv add bullmq
# Test: crear worker que consuma job de prueba
```

Si falla, pivotar a arquitectura alternativa (documentar en ADR).

---

## Rollback Plan

### Escenario: Falla total del scaffolding

1. Eliminar directorios creados: `/api`, `/worker`, `/docker`, `/prisma`
2. Revertir cambios en archivos raíz (package.json, etc.)
3. `docker-compose down -v` para limpiar volúmenes

### Escenario: BullMQ Python no viable

1. Mantener estructura de `/api` y `/worker`
2. Reemplazar adapter de BullMQ en worker por:
   - Opción A: Celery + Redis
   - Opción B: HTTP polling desde api a worker
3. Documentar decisión en ADR

### Escenario: Performance PostgreSQL JSONB insuficiente

1. Agregar MongoDB a docker-compose.yml
2. Crear adapter alternativo en `/api`
3. Migrar datos de JSONB a MongoDB (script)

---

## Success Criteria

### Funcionales

- [ ] `docker-compose up` levanta todos los servicios sin errores
- [ ] `curl localhost:3000/health` retorna `{ "status": "ok" }` (api)
- [ ] `curl localhost:8000/health` retorna `{ "status": "ok" }` (worker)
- [ ] PostgreSQL accesible con schemas creados (prisma migrate)
- [ ] Redis accesible desde ambos servicios
- [ ] MinIO accesible con bucket inicial creado

### Estructurales

- [ ] Arquitectura hexagonal implementada en `/api`:
  - `src/domain/`, `src/application/`, `src/infrastructure/`
- [ ] Arquitectura hexagonal implementada en `/worker`:
  - `src/domain/`, `src/application/`, `src/infrastructure/`
- [ ] Prisma schemas definidos: User, Dataset, TransformationLog
- [ ] `.env.example` documentado con todas las variables
- [ ] README.md con instrucciones de setup

### Validaciones Técnicas

- [ ] TypeScript compila sin errores (`pnpm build`)
- [ ] Python type-checks pasa (`uv run mypy`)
- [ ] Linters pasan en ambos proyectos
- [ ] Spike BullMQ Python exitoso (o alternativa documentada)

---

## Notes

### Stack Final MVP

```
/backend
├── api/                    # Node.js + Express + TypeScript
│   └── src/
│       ├── domain/         # Entities, Ports
│       ├── application/    # Use Cases
│       └── infrastructure/ # HTTP, Prisma, BullMQ adapters
├── worker/                 # Python + FastAPI
│   └── src/
│       ├── domain/         # Entities, Ports  
│       ├── application/    # Use Cases
│       └── infrastructure/ # BullMQ, S3, DB adapters
├── prisma/                 # Shared schemas
├── docker/                 # Docker configs
└── docker-compose.yml      # Local dev environment
```

### Referencias

- Análisis previo: `openspec/changes/scaffolding-backend-mvp/exploration.md` (si existe)
- Config del proyecto: `openspec/config.yaml`
