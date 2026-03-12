import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';

/**
 * PostgreSQL container fixture for integration tests.
 * Uses testcontainers to spin up a real PostgreSQL instance.
 */
export class PostgresContainerFixture {
  private container: StartedPostgreSqlContainer | null = null;

  async start(): Promise<StartedPostgreSqlContainer> {
    this.container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('test_db')
      .withUsername('test_user')
      .withPassword('test_password')
      .start();

    return this.container;
  }

  async stop(): Promise<void> {
    if (this.container) {
      await this.container.stop();
      this.container = null;
    }
  }

  getConnectionString(): string {
    if (!this.container) {
      throw new Error('PostgreSQL container not started');
    }
    return this.container.getConnectionUri();
  }

  getContainer(): StartedPostgreSqlContainer | null {
    return this.container;
  }
}

/**
 * Redis container fixture for integration tests.
 * Uses testcontainers to spin up a real Redis instance.
 */
export class RedisContainerFixture {
  private container: StartedRedisContainer | null = null;

  async start(): Promise<StartedRedisContainer> {
    this.container = await new RedisContainer('redis:7-alpine').start();

    return this.container;
  }

  async stop(): Promise<void> {
    if (this.container) {
      await this.container.stop();
      this.container = null;
    }
  }

  getHost(): string {
    if (!this.container) {
      throw new Error('Redis container not started');
    }
    return this.container.getHost();
  }

  getPort(): number {
    if (!this.container) {
      throw new Error('Redis container not started');
    }
    return this.container.getPort();
  }

  getConnectionUrl(): string {
    if (!this.container) {
      throw new Error('Redis container not started');
    }
    return this.container.getConnectionUrl();
  }

  getContainer(): StartedRedisContainer | null {
    return this.container;
  }
}

// Convenience factory functions
export function createPostgresContainer(): PostgresContainerFixture {
  return new PostgresContainerFixture();
}

export function createRedisContainer(): RedisContainerFixture {
  return new RedisContainerFixture();
}
