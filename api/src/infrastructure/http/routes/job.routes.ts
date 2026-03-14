import { Router } from 'express';
import type { Container } from '../../config/container.js';
import { JobController } from '../controllers/JobController.js';

/**
 * Create job routes.
 * All routes are prefixed with /api/v1/jobs
 */
export function createJobRoutes(container: Container): Router {
  const router = Router();
  const controller = new JobController(container);

  /**
   * @openapi
   * /jobs/{jobId}:
   *   get:
   *     tags:
   *       - Jobs
   *     summary: Get the status of a transformation job (polling)
   *     description: |
   *       Poll this endpoint to check the current status of an async ETL job.
   *       For real-time updates prefer the SSE endpoint `GET /api/v1/jobs/{jobId}/events`.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: jobId
   *         required: true
   *         schema:
   *           type: string
   *         description: BullMQ job ID returned when the job was created
   *     responses:
   *       '200':
   *         description: Job status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/JobStatus'
   *       '404':
   *         description: Job not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  // GET /api/v1/jobs/:jobId - Get job status (polling)
  router.get('/:jobId', (req, res, next) => {
    controller.getStatus(req, res, next).catch(next);
  });

  /**
   * @openapi
   * /jobs/{jobId}/events:
   *   get:
   *     tags:
   *       - Jobs
   *     summary: Subscribe to real-time job status updates via Server-Sent Events (SSE)
   *     description: |
   *       Opens a persistent SSE connection that pushes `status` events as the job
   *       progresses.  Closes automatically when the job reaches a terminal state
   *       (`completed` or `failed`) or after 10 minutes.
   *
   *       **Event types emitted:**
   *       - `status` — job state changed (`waiting`, `active`, `processing`, `completed`, `failed`)
   *       - `error` — job not found
   *       - `timeout` — stream closed after 10 min hard limit
   *       - `: keepalive` — comment frame sent every 15 s to keep the connection alive
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: jobId
   *         required: true
   *         schema:
   *           type: string
   *         description: BullMQ job ID
   *     responses:
   *       '200':
   *         description: SSE stream opened
   *         content:
   *           text/event-stream:
   *             schema:
   *               type: string
   *               example: |
   *                 event: status
   *                 data: {"jobId":"abc123","status":"processing"}
   *       '400':
   *         description: Job ID is required
   */
  // GET /api/v1/jobs/:jobId/events - SSE stream for real-time job status
  router.get('/:jobId/events', (req, res, next) => {
    controller.streamEvents(req, res).catch(next);
  });

  return router;
}
