import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test the module in isolation, so we'll import it dynamically
describe('env', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    // Set up minimal valid environment
    process.env = {
      ...originalEnv,
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      JWT_SECRET: 'test-secret-key-for-testing',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('loadEnv', () => {
    it('should load and validate environment variables with defaults', async () => {
      const { loadEnv } = await import('../env.js');

      const env = loadEnv();

      // NODE_ENV is 'test' when running tests (set by Vitest)
      expect(env.NODE_ENV).toBe('test');
      expect(env.PORT).toBe(3000);
      expect(env.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/db');
      expect(env.REDIS_HOST).toBe('localhost');
      expect(env.REDIS_PORT).toBe(6379);
      expect(env.LOG_LEVEL).toBe('info');
    });

    it('should accept valid NODE_ENV values', async () => {
      process.env['NODE_ENV'] = 'production';
      const { loadEnv } = await import('../env.js');

      const env = loadEnv();

      expect(env.NODE_ENV).toBe('production');
    });

    it('should accept test NODE_ENV', async () => {
      process.env['NODE_ENV'] = 'test';
      const { loadEnv } = await import('../env.js');

      const env = loadEnv();

      expect(env.NODE_ENV).toBe('test');
    });

    it('should coerce PORT to number', async () => {
      process.env['PORT'] = '8080';
      const { loadEnv } = await import('../env.js');

      const env = loadEnv();

      expect(env.PORT).toBe(8080);
      expect(typeof env.PORT).toBe('number');
    });

    it('should coerce REDIS_PORT to number', async () => {
      process.env['REDIS_PORT'] = '6380';
      const { loadEnv } = await import('../env.js');

      const env = loadEnv();

      expect(env.REDIS_PORT).toBe(6380);
    });

    it('should coerce MINIO_PORT to number', async () => {
      process.env['MINIO_PORT'] = '9001';
      const { loadEnv } = await import('../env.js');

      const env = loadEnv();

      expect(env.MINIO_PORT).toBe(9001);
    });

    it('should transform MINIO_USE_SSL string to boolean true', async () => {
      process.env['MINIO_USE_SSL'] = 'true';
      const { loadEnv } = await import('../env.js');

      const env = loadEnv();

      expect(env.MINIO_USE_SSL).toBe(true);
    });

    it('should transform MINIO_USE_SSL string to boolean false', async () => {
      process.env['MINIO_USE_SSL'] = 'false';
      const { loadEnv } = await import('../env.js');

      const env = loadEnv();

      expect(env.MINIO_USE_SSL).toBe(false);
    });

    it('should use default MINIO bucket names', async () => {
      const { loadEnv } = await import('../env.js');

      const env = loadEnv();

      expect(env.MINIO_BUCKET_DATASETS).toBe('datasets');
      expect(env.MINIO_BUCKET_RESULTS).toBe('results');
      expect(env.MINIO_BUCKET_TEMP).toBe('temp');
    });

    it('should accept custom MINIO bucket names', async () => {
      process.env['MINIO_BUCKET_DATASETS'] = 'custom-datasets';
      process.env['MINIO_BUCKET_RESULTS'] = 'custom-results';
      process.env['MINIO_BUCKET_TEMP'] = 'custom-temp';
      const { loadEnv } = await import('../env.js');

      const env = loadEnv();

      expect(env.MINIO_BUCKET_DATASETS).toBe('custom-datasets');
      expect(env.MINIO_BUCKET_RESULTS).toBe('custom-results');
      expect(env.MINIO_BUCKET_TEMP).toBe('custom-temp');
    });

    it('should throw error when DATABASE_URL is missing', async () => {
      delete process.env['DATABASE_URL'];
      const { loadEnv } = await import('../env.js');

      expect(() => loadEnv()).toThrow('Environment validation failed');
    });

    it('should throw error when DATABASE_URL is not a valid URL', async () => {
      process.env['DATABASE_URL'] = 'not-a-url';
      const { loadEnv } = await import('../env.js');

      expect(() => loadEnv()).toThrow('Environment validation failed');
    });

    it('should throw error for invalid NODE_ENV', async () => {
      process.env['NODE_ENV'] = 'invalid';
      const { loadEnv } = await import('../env.js');

      expect(() => loadEnv()).toThrow('Environment validation failed');
    });

    it('should throw error for invalid LOG_LEVEL', async () => {
      process.env['LOG_LEVEL'] = 'invalid';
      const { loadEnv } = await import('../env.js');

      expect(() => loadEnv()).toThrow('Environment validation failed');
    });

    it('should accept all valid LOG_LEVEL values', async () => {
      const validLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];

      for (const level of validLevels) {
        vi.resetModules();
        process.env = {
          ...originalEnv,
          DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
          JWT_SECRET: 'test-secret-key-for-testing',
          LOG_LEVEL: level,
        };
        const { loadEnv } = await import('../env.js');
        const env = loadEnv();
        expect(env.LOG_LEVEL).toBe(level);
      }
    });

    it('should allow optional MINIO credentials', async () => {
      const { loadEnv } = await import('../env.js');

      const env = loadEnv();

      expect(env.MINIO_ACCESS_KEY).toBeUndefined();
      expect(env.MINIO_SECRET_KEY).toBeUndefined();
    });

    it('should accept MINIO credentials when provided', async () => {
      process.env['MINIO_ACCESS_KEY'] = 'minioadmin';
      process.env['MINIO_SECRET_KEY'] = 'minioadmin';
      const { loadEnv } = await import('../env.js');

      const env = loadEnv();

      expect(env.MINIO_ACCESS_KEY).toBe('minioadmin');
      expect(env.MINIO_SECRET_KEY).toBe('minioadmin');
    });
  });

  describe('getEnv', () => {
    it('should return cached environment on subsequent calls', async () => {
      const { getEnv } = await import('../env.js');

      const env1 = getEnv();
      const env2 = getEnv();

      expect(env1).toBe(env2); // Same reference (cached)
    });

    it('should return valid environment configuration', async () => {
      const { getEnv } = await import('../env.js');

      const env = getEnv();

      expect(env).toHaveProperty('NODE_ENV');
      expect(env).toHaveProperty('PORT');
      expect(env).toHaveProperty('DATABASE_URL');
      expect(env).toHaveProperty('REDIS_HOST');
      expect(env).toHaveProperty('REDIS_PORT');
    });
  });

  describe('Env type', () => {
    it('should have correct property types', async () => {
      const { loadEnv } = await import('../env.js');

      const env = loadEnv();

      // Type assertions via runtime checks
      expect(typeof env.NODE_ENV).toBe('string');
      expect(typeof env.PORT).toBe('number');
      expect(typeof env.DATABASE_URL).toBe('string');
      expect(typeof env.REDIS_HOST).toBe('string');
      expect(typeof env.REDIS_PORT).toBe('number');
      expect(typeof env.MINIO_ENDPOINT).toBe('string');
      expect(typeof env.MINIO_PORT).toBe('number');
      expect(typeof env.MINIO_USE_SSL).toBe('boolean');
      expect(typeof env.LOG_LEVEL).toBe('string');
    });
  });
});
