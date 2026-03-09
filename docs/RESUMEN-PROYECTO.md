# PYMES Data Strategy - Resumen del Proyecto

**Fecha de actualización:** 8 de Marzo, 2026  
**Estado actual:** Scaffolding completado - Listo para desarrollo de funcionalidades

---

## Qué es este sistema

PYMES Data Strategy es una plataforma de limpieza y transformación de datos con asistencia de inteligencia artificial. Está diseñada para pequeñas y medianas empresas que necesitan procesar sus datos (Excel, CSV, etc.) de forma eficiente y con intervención humana cuando sea necesario.

El concepto central es **Human-in-the-Loop**: la IA sugiere transformaciones y correcciones, pero el usuario tiene la última palabra. Esto combina la velocidad del procesamiento automático con la precisión del criterio humano.

### Componentes principales

El backend está dividido en dos servicios que trabajan juntos:

1. **API Gateway (Node.js)**: Es la puerta de entrada al sistema. Recibe las peticiones del frontend, gestiona usuarios, datasets y trabajos de transformación. Está construido con Express, TypeScript y Prisma.

2. **Worker ETL (Python)**: Es el motor de procesamiento. Recibe trabajos de la API, procesa los archivos usando Polars/Pandas, aplica las transformaciones y devuelve los resultados. Está construido con FastAPI.

3. **Infraestructura de soporte**:
   - PostgreSQL para almacenar datos estructurados
   - Redis para la cola de mensajes entre API y Worker
   - MinIO para almacenar archivos (similar a Amazon S3 pero local)

### Cómo se comunican los servicios

```
Usuario → Frontend → API Gateway → Redis (BullMQ) → Worker ETL
                         ↓                              ↓
                    PostgreSQL                       MinIO
                    (metadatos)                    (archivos)
```

El usuario sube un archivo a través del frontend. La API lo guarda en MinIO y crea un trabajo en la cola de Redis. El Worker toma el trabajo, procesa el archivo, y guarda los resultados. La API notifica al usuario cuando está listo.

---

## En qué etapa estamos

### Fase completada: Scaffolding (100%)

Terminamos la construcción de toda la estructura base del proyecto. Esto incluye:

- **Infraestructura Docker**: Todos los servicios levantan con un solo comando (`make up`). PostgreSQL, Redis y MinIO están configurados y funcionando.

- **API Gateway estructurada**: El proyecto Node.js está configurado con TypeScript estricto, linting, formateo automático, y arquitectura hexagonal. La base de datos tiene sus modelos definidos (usuarios, datasets, trabajos, auditoría).

- **Worker ETL estructurado**: El proyecto Python está configurado con FastAPI, tipado estricto, y la misma arquitectura hexagonal que la API. Tiene sus entidades y puertos definidos.

- **Comunicación verificada**: Ambos servicios pueden conectarse a Redis y están listos para usar BullMQ como sistema de mensajería.

- **Health checks funcionando**: Puedes verificar que todo está bien visitando `localhost:3000/health` (API) y `localhost:8000/health` (Worker).

### Lo que NO está implementado todavía

La estructura está lista, pero los servicios aún no hacen nada útil. Son como un edificio terminado pero sin muebles ni habitantes.

---

## Qué falta para el MVP

El MVP (Producto Mínimo Viable) permitiría a un usuario subir un archivo, aplicar transformaciones básicas, y descargar el resultado. Estas son las funcionalidades pendientes:

### 1. Gestión de Datasets (API)
- Endpoint para subir archivos CSV/Excel
- Endpoint para listar datasets del usuario
- Endpoint para ver detalles de un dataset
- Endpoint para eliminar un dataset
- Integración con MinIO para guardar los archivos

### 2. Sistema de Trabajos (API + Worker)
- Crear trabajos de transformación desde la API
- Publicar trabajos en la cola de Redis (BullMQ)
- Worker que escuche la cola y procese trabajos
- Actualizar estado del trabajo en PostgreSQL
- Notificar cuando un trabajo termine

### 3. Transformaciones básicas (Worker)
- **Limpieza**: Eliminar filas vacías, normalizar espacios, corregir formatos de fecha
- **Normalización**: Convertir a mayúsculas/minúsculas, estandarizar valores
- **Deduplicación**: Identificar y marcar registros duplicados

### 4. Autenticación (API)
- Registro de usuarios
- Login con JWT
- Protección de endpoints
- Asociar datasets a usuarios

### 5. Resultados (API + Worker)
- Guardar archivo transformado en MinIO
- Endpoint para descargar resultados
- Historial de transformaciones aplicadas

---

## Nice to have (después del MVP)

Estas funcionalidades harían el producto más completo pero no son esenciales para la primera versión:

### Experiencia de usuario
- **Preview en tiempo real**: Ver cómo quedarían los datos antes de aplicar la transformación
- **Undo/Redo**: Poder deshacer transformaciones
- **Plantillas de transformación**: Guardar secuencias de transformaciones para reutilizar
- **Procesamiento incremental**: Aplicar transformaciones solo a filas nuevas

### Inteligencia Artificial
- **Sugerencias automáticas**: La IA detecta problemas y sugiere correcciones
- **Detección de anomalías**: Identificar valores que parecen erróneos
- **Clasificación automática**: Categorizar datos basándose en patrones
- **Mapeo inteligente de columnas**: Sugerir cómo unificar columnas de diferentes fuentes

### Colaboración
- **Múltiples usuarios por organización**: Equipos trabajando en los mismos datos
- **Comentarios y anotaciones**: Discutir transformaciones antes de aplicarlas
- **Flujos de aprobación**: Un usuario propone, otro aprueba

### Integraciones
- **Conexión a bases de datos**: Importar directamente desde MySQL, PostgreSQL, etc.
- **APIs externas**: Conectar con CRMs, ERPs, hojas de cálculo en la nube
- **Exportación programada**: Enviar resultados automáticamente a otros sistemas
- **Webhooks**: Notificar a sistemas externos cuando termina un proceso

### Escalabilidad
- **Múltiples workers**: Procesar varios archivos en paralelo
- **Archivos grandes**: Soporte para datasets de millones de filas
- **Procesamiento distribuido**: Dividir archivos grandes entre varios workers

---

## Cómo levantar el proyecto

```bash
# Clonar el repositorio y entrar a la carpeta
cd backend

# Copiar variables de entorno
cp .env.example .env

# Levantar todos los servicios
make up

# Verificar que todo está funcionando
curl localhost:3000/health  # API
curl localhost:8000/health  # Worker
```

---

## Estructura del proyecto

```
backend/
├── api/                    # API Gateway (Node.js)
│   └── src/
│       ├── domain/         # Entidades y reglas de negocio
│       ├── application/    # Casos de uso (por implementar)
│       └── infrastructure/ # Express, Prisma, etc.
│
├── worker/                 # Worker ETL (Python)
│   └── src/
│       ├── domain/         # Entidades y reglas de negocio
│       ├── application/    # Casos de uso (por implementar)
│       └── infrastructure/ # FastAPI, BullMQ, etc.
│
├── prisma/                 # Esquema de base de datos
├── docker/                 # Configuraciones de Docker
├── docs/                   # Documentación (este archivo)
└── openspec/               # Especificaciones técnicas detalladas
```

---

## Decisiones técnicas importantes

1. **PostgreSQL en lugar de MongoDB**: Elegimos PostgreSQL porque ofrece mejor soporte para consultas complejas y transacciones. Usamos JSONB para datos semi-estructurados cuando es necesario.

2. **BullMQ para mensajería**: Permite que Node.js y Python se comuniquen de forma asíncrona usando Redis como intermediario. Es más simple que Kafka o RabbitMQ para nuestro caso de uso.

3. **Arquitectura Hexagonal**: Separamos el código en capas (dominio, aplicación, infraestructura) para que sea más fácil de mantener y testear. El dominio no depende de frameworks externos.

4. **Monorepo**: API y Worker viven en el mismo repositorio para facilitar el desarrollo y despliegue coordinado.

---

## Contacto y recursos

- **Especificaciones técnicas detalladas**: `openspec/changes/scaffolding-backend-mvp/design.md`
- **Lista de tareas completadas**: `openspec/changes/scaffolding-backend-mvp/tasks.md`
- **README técnico**: `README.md` en la raíz del proyecto
