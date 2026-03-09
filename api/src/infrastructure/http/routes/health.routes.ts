import { Router } from 'express';
import type { Container } from '../../config/container.js';
import { HealthController } from '../controllers/HealthController.js';

/**
 * Create health routes.
 */
export function createHealthRoutes(container: Container): Router {
  const router = Router();
  const healthController = new HealthController(container);

  router.get('/health', (req, res, next) => {
    healthController.check(req, res).catch(next);
  });

  return router;
}
