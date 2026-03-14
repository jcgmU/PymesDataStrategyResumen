import { z } from 'zod';

/**
 * Environment variable schema with validation.
 */
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  // PostgreSQL (via Prisma)
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),

  // MinIO
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ACCESS_KEY: z.string().optional(),
  MINIO_SECRET_KEY: z.string().optional(),
  MINIO_USE_SSL: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  MINIO_BUCKET_DATASETS: z.string().default('datasets'),
  MINIO_BUCKET_RESULTS: z.string().default('results'),
  MINIO_BUCKET_TEMP: z.string().default('temp'),

  // JWT
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables.
 * Throws on validation failure with descriptive errors.
 */
export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');

    throw new Error(`Environment validation failed:\n${errors}`);
  }

  return result.data;
}

// Singleton instance
let envInstance: Env | null = null;

/**
 * Get validated environment variables.
 * Lazily loads and caches the result.
 */
export function getEnv(): Env {
  if (envInstance === null) {
    envInstance = loadEnv();
  }
  return envInstance;
}
