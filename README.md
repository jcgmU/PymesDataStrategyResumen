# PYMES Data Strategy - Backend

Sistema ETL con Human-in-the-Loop para limpieza de datos asistida por IA.

## Arquitectura

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

## Stack Tecnológico

### API Gateway (Node.js)
- **Express 4.21** - Framework web
- **TypeScript 5.7** - Tipado estático
- **Prisma 6.4** - ORM para base de datos
- **BullMQ 5.34** - Productor de cola de trabajos
- **Zod 3.24** - Validación de esquemas

### Worker ETL (Python)
- **FastAPI 0.115** - Framework web
- **Polars 1.23** - Procesamiento de datos de alto rendimiento
- **Pandas 2.2** - Manipulación de datos
- **BullMQ 2.9** - Consumidor de cola de trabajos (binding Python)
- **Pydantic 2.10** - Configuración y validación

### Infraestructura
- **PostgreSQL 16** - Base de datos relacional
- **Redis 7.4** - Broker de mensajes (BullMQ)
- **MinIO** - Almacenamiento de objetos compatible con S3

## Inicio Rápido

```bash
# Iniciar todos los servicios
make up

# Ver estado
make ps

# Ver logs
make logs
```

## Servicios

| Servicio   | URL                       | Descripción              |
|------------|---------------------------|--------------------------|
| API        | http://localhost:3000     | API Gateway              |
| Worker     | http://localhost:8000     | Worker ETL               |
| MinIO      | http://localhost:9001     | Consola de almacenamiento|
| PostgreSQL | localhost:5433            | Base de datos            |
| Redis      | localhost:6380            | Broker de mensajes       |

## Endpoints de Salud

```bash
# API Gateway
curl http://localhost:3000/health

# Worker ETL
curl http://localhost:8000/health
curl http://localhost:8000/health/live   # Sonda de vida
curl http://localhost:8000/health/ready  # Sonda de preparación
```

## Desarrollo

### Desarrollo Local (sin Docker)

```bash
# Iniciar solo infraestructura
make up

# Ejecutar API localmente
make api-dev

# Ejecutar Worker localmente (requiere uv)
make worker-dev
```

### Base de Datos

```bash
# Ejecutar migraciones
make db-migrate

# Abrir Prisma Studio
make db-studio

# Resetear base de datos (¡ADVERTENCIA: pérdida de datos!)
make db-reset
```

### Utilidades

```bash
# CLI de PostgreSQL
make psql

# CLI de Redis
make redis-cli

# Instalar dependencias
make install

# Lint del código
make lint

# Verificar tipos
make typecheck
```

## Estructura del Proyecto

```
backend/
├── api/                      # API Gateway (Node.js)
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
├── worker/                   # Worker ETL (Python)
│   └── src/
│       ├── domain/           # Lógica de negocio (núcleo hexagonal)
│       │   ├── entities/
│       │   ├── value_objects/
│       │   ├── ports/
│       │   └── errors/
│       ├── application/      # Casos de uso y DTOs
│       └── infrastructure/   # Adaptadores (HTTP, Almacenamiento, Cola)
│           ├── config/
│           ├── http/
│           ├── messaging/
│           └── storage/
├── prisma/                   # Esquema de BD y migraciones
├── docker/                   # Configuraciones Docker
├── docs/                     # Documentación del proyecto
├── openspec/                 # Artefactos SDD
├── docker-compose.yml        # Orquestación de contenedores
├── Makefile                  # Comandos de desarrollo
└── README.md                 # Este archivo
```

## Variables de Entorno

Copiar `.env.example` a `.env`:

```bash
cp .env.example .env
```

Variables principales:
- `POSTGRES_PORT=5433` - Puerto de PostgreSQL (evita conflictos)
- `REDIS_PORT=6380` - Puerto de Redis (evita conflictos)
- `API_PORT=3000` - Puerto del API Gateway
- `WORKER_PORT=8000` - Puerto del Worker ETL

## Decisiones de Arquitectura

Ver `openspec/` para documentos de diseño completos. Decisiones clave:

1. **ADR-001: PostgreSQL + JSONB sobre MongoDB** - Stack simplificado, JSONB maneja necesidades de documentos
2. **ADR-002: BullMQ para mensajería** - Funciona tanto en Node.js como en Python
3. **Arquitectura Hexagonal** - Separación limpia entre dominio, aplicación e infraestructura

## Solución de Problemas

### Conflictos de puertos
Si los puertos 5432 o 6379 están en uso, el `.env` por defecto usa puertos alternativos (5433, 6380).

### Problemas con Docker
```bash
# Eliminar todos los contenedores y volúmenes
make clean

# Reconstruir imágenes
docker compose build --no-cache
```

### Problemas con Prisma
```bash
# Regenerar cliente
make db-generate

# Ver estado actual de la BD
make db-studio
```

## Documentación Adicional

Para un resumen completo del proyecto en lenguaje natural, ver `docs/RESUMEN-PROYECTO.md`.

## Licencia

MIT
