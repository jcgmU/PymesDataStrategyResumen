import type { Request, Response } from 'express';
import type { Container } from '../../config/container.js';

interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: boolean;
    redis: boolean;
  };
}

/**
 * Health check controller.
 * Reports connectivity status of all infrastructure dependencies.
 */
export class HealthController {
  constructor(private readonly container: Container) {}

  async check(_req: Request, res: Response): Promise<void> {
    const checks = {
      database: await this.container.checkDatabase(),
      redis: await this.container.checkRedis(),
    };

    const allHealthy = Object.values(checks).every(Boolean);
    const anyHealthy = Object.values(checks).some(Boolean);

    let status: HealthCheckResult['status'];
    if (allHealthy) {
      status = 'ok';
    } else if (anyHealthy) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    const result: HealthCheckResult = {
      status,
      timestamp: new Date().toISOString(),
      checks,
    };

    const httpStatus = allHealthy ? 200 : 503;
    res.status(httpStatus).json(result);
  }
}
