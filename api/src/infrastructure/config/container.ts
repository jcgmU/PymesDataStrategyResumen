import { Redis } from 'ioredis';
import { type Env, getEnv } from './env.js';
import { getPrismaClient, disconnectPrisma } from '../persistence/prisma/client.js';
import type { PrismaClient } from '@prisma/client';

/**
 * Simple dependency injection container.
 * Manages singleton instances of infrastructure services.
 */
export class Container {
  private readonly env: Env;
  private redisInstance: Redis | null = null;

  constructor() {
    this.env = getEnv();
  }

  get config(): Env {
    return this.env;
  }

  get prisma(): PrismaClient {
    return getPrismaClient();
  }

  get redis(): Redis {
    if (this.redisInstance === null) {
      this.redisInstance = new Redis({
        host: this.env.REDIS_HOST,
        port: this.env.REDIS_PORT,
        maxRetriesPerRequest: null, // Required for BullMQ
        enableReadyCheck: false,
      });
    }
    return this.redisInstance;
  }

  /**
   * Check if the database connection is healthy.
   */
  async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if Redis connection is healthy.
   */
  async checkRedis(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Gracefully shutdown all connections.
   */
  async shutdown(): Promise<void> {
    if (this.redisInstance !== null) {
      await this.redisInstance.quit();
      this.redisInstance = null;
    }
    await disconnectPrisma();
  }
}

// Singleton container instance
let containerInstance: Container | null = null;

/**
 * Get the container singleton.
 */
export function getContainer(): Container {
  if (containerInstance === null) {
    containerInstance = new Container();
  }
  return containerInstance;
}
