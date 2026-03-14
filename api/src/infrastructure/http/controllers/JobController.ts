import type { Request, Response, NextFunction } from 'express';
import type { Container } from '../../config/container.js';
import { GetJobStatusUseCase } from '../../../application/use-cases/GetJobStatusUseCase.js';
import { ValidationError } from '../../../domain/errors/ValidationError.js';

/** Terminal states returned by GetJobStatusUseCase (lowercase from BullMQ mapping). */
const TERMINAL_STATUSES = ['completed', 'failed'] as const;

/** SSE keepalive interval in ms. */
const KEEPALIVE_INTERVAL_MS = 15_000;

/** Max SSE stream duration in ms (10 minutes). */
const MAX_STREAM_DURATION_MS = 10 * 60 * 1_000;

/**
 * Controller for job-related HTTP endpoints.
 */
export class JobController {
  constructor(private readonly container: Container) {}

  /**
   * GET /api/v1/jobs/:jobId
   * Get the status of a transformation job.
   */
  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const jobId = req.params['jobId'] as string;

      if (!jobId) {
        throw new ValidationError('Job ID is required', 'jobId');
      }

      const useCase = new GetJobStatusUseCase(this.container.jobQueue);
      const result = await useCase.execute({ jobId });

      if (!result) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Job with ID ${jobId} not found`,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          jobId: result.jobId,
          status: result.status,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/jobs/:jobId/events
   * Server-Sent Events stream for real-time job status updates.
   * Sends an initial `status` event immediately, then pushes updates
   * via BullMQ QueueEvents until the job reaches a terminal state.
   */
  async streamEvents(req: Request, res: Response): Promise<void> {
    const jobId = req.params['jobId'] as string;

    if (!jobId) {
      res.status(400).json({ error: 'Job ID is required' });
      return;
    }

    // ── SSE headers ──────────────────────────────────────────────────────────
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
    res.flushHeaders();

    // ── Helper to write SSE frames ────────────────────────────────────────────
    const send = (event: string, data: Record<string, unknown>): void => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // ── Initial state snapshot ────────────────────────────────────────────────
    const useCase = new GetJobStatusUseCase(this.container.jobQueue);
    const current = await useCase.execute({ jobId });

    if (!current) {
      send('error', { message: `Job ${jobId} not found` });
      res.end();
      return;
    }

    send('status', { jobId, status: current.status });

    // If already terminal — close immediately
    if ((TERMINAL_STATUSES as readonly string[]).includes(current.status)) {
      res.end();
      return;
    }

    // ── Subscribe to BullMQ QueueEvents ──────────────────────────────────────
    const qe = this.container.queueEvents;
    let closed = false;

    const cleanup = (): void => {
      if (closed) return;
      closed = true;
      clearInterval(keepalive);
      clearTimeout(timeout);
      res.end();
    };

    const onActive = (id: string): void => {
      if (id === jobId) send('status', { jobId, status: 'processing' });
    };

    const onCompleted = (id: string): void => {
      if (id === jobId) {
        send('status', { jobId, status: 'completed' });
        cleanup();
      }
    };

    const onFailed = (id: string, failedReason: string): void => {
      if (id === jobId) {
        send('status', { jobId, status: 'failed', error: failedReason });
        cleanup();
      }
    };

    qe.onJobActive(onActive);
    qe.onJobCompleted(onCompleted);
    qe.onJobFailed(onFailed);

    // ── Keepalive comment every 15s (proxies drop idle SSE connections) ───────
    const keepalive = setInterval(() => {
      if (!closed) res.write(': keepalive\n\n');
    }, KEEPALIVE_INTERVAL_MS);

    // ── Hard timeout after 10 minutes ────────────────────────────────────────
    const timeout = setTimeout(() => {
      if (!closed) {
        send('timeout', { message: 'Stream closed after 10 minutes' });
        cleanup();
      }
    }, MAX_STREAM_DURATION_MS);

    // ── Client disconnect ─────────────────────────────────────────────────────
    req.on('close', cleanup);
  }
}

