import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import {
  PostgresContainerFixture,
  RedisContainerFixture,
} from '../fixtures/containers.js';

/**
 * Integration tests for Container health check methods.
 * Uses real PostgreSQL and Redis containers via testcontainers.
 */
describe('Container Integration Tests', () => {
  describe('checkDatabase', () => {
    let postgresFixture: PostgresContainerFixture;
    let prismaClient: PrismaClient;

    beforeAll(async () => {
      postgresFixture = new PostgresContainerFixture();
      await postgresFixture.start();

      // Create Prisma client with container connection
      const connectionString = postgresFixture.getConnectionString();
      prismaClient = new PrismaClient({
        datasources: {
          db: {
            url: connectionString,
          },
        },
      });

      await prismaClient.$connect();
    }, 60000);

    afterAll(async () => {
      if (prismaClient) {
        await prismaClient.$disconnect();
      }
      await postgresFixture.stop();
    }, 30000);

    it('should return true when PostgreSQL is healthy', async () => {
      // Execute a simple query to verify connection
      const result = await prismaClient.$queryRaw<[{ result: number }]>`SELECT 1 as result`;
      expect(result[0].result).toBe(1);
    });

    it('should be able to execute database health check query', async () => {
      // This mimics the Container.checkDatabase() logic
      let isHealthy = false;
      try {
        await prismaClient.$queryRaw`SELECT 1`;
        isHealthy = true;
      } catch {
        isHealthy = false;
      }

      expect(isHealthy).toBe(true);
    });
  });

  describe('checkRedis', () => {
    let redisFixture: RedisContainerFixture;
    let redisClient: Redis;

    beforeAll(async () => {
      redisFixture = new RedisContainerFixture();
      await redisFixture.start();

      // Create Redis client with container connection
      redisClient = new Redis({
        host: redisFixture.getHost(),
        port: redisFixture.getPort(),
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
    }, 60000);

    afterAll(async () => {
      if (redisClient) {
        await redisClient.quit();
      }
      await redisFixture.stop();
    }, 30000);

    it('should return PONG when Redis is healthy', async () => {
      const result = await redisClient.ping();
      expect(result).toBe('PONG');
    });

    it('should be able to execute Redis health check', async () => {
      // This mimics the Container.checkRedis() logic
      let isHealthy = false;
      try {
        const result = await redisClient.ping();
        isHealthy = result === 'PONG';
      } catch {
        isHealthy = false;
      }

      expect(isHealthy).toBe(true);
    });

    it('should be able to set and get values', async () => {
      const testKey = 'test:integration:key';
      const testValue = 'integration-test-value';

      await redisClient.set(testKey, testValue);
      const result = await redisClient.get(testKey);

      expect(result).toBe(testValue);

      // Cleanup
      await redisClient.del(testKey);
    });
  });
});
