import { Router } from 'express';
import type { Container } from '../../config/container.js';
import { StatsController } from '../controllers/StatsController.js';
import { createAuthMiddleware } from '../middleware/AuthMiddleware.js';

/**
 * Create stats routes.
 * All routes are prefixed with /api/v1/stats
 */
export function createStatsRoutes(container: Container): Router {
  const router = Router();
  const controller = new StatsController(container);
  const authMiddleware = createAuthMiddleware(container.jwtService);

  /**
   * @openapi
   * /stats:
   *   get:
   *     tags:
   *       - Stats
   *     summary: Get aggregated statistics for the authenticated user
   *     description: |
   *       Returns platform usage statistics scoped to the authenticated user,
   *       including dataset counts, job counts, and processing summaries.
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: Aggregated user statistics
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   description: Aggregated statistics object
   *       '401':
   *         description: Missing or invalid JWT token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  // GET /api/v1/stats - Get aggregated user statistics
  router.get('/', authMiddleware, (req, res, next) => {
    controller.getStats(req, res, next).catch(next);
  });

  return router;
}
