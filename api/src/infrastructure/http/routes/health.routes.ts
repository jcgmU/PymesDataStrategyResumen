import { Router } from 'express';
import type { Container } from '../../config/container.js';
import { HealthController } from '../controllers/HealthController.js';

/**
 * Create health routes.
 */
export function createHealthRoutes(container: Container): Router {
  const router = Router();
  const healthController = new HealthController(container);

  /**
   * @openapi
   * /health:
   *   get:
   *     tags:
   *       - Health
   *     summary: Service health check
   *     description: |
   *       Reports connectivity status for all infrastructure dependencies
   *       (PostgreSQL database and Redis).  Returns HTTP 200 when all checks pass,
   *       or HTTP 503 when one or more checks fail.
   *     security: []
   *     responses:
   *       '200':
   *         description: All dependencies healthy
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   enum:
   *                     - ok
   *                     - degraded
   *                     - unhealthy
   *                   example: ok
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                 checks:
   *                   type: object
   *                   properties:
   *                     database:
   *                       type: boolean
   *                     redis:
   *                       type: boolean
   *       '503':
   *         description: One or more dependencies unavailable
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   enum:
   *                     - degraded
   *                     - unhealthy
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                 checks:
   *                   type: object
   *                   properties:
   *                     database:
   *                       type: boolean
   *                     redis:
   *                       type: boolean
   */
  router.get('/health', (req, res, next) => {
    healthController.check(req, res).catch(next);
  });

  return router;
}
