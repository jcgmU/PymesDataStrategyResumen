import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { JobController } from '../JobController.js';
import type { Container } from '../../../config/container.js';
import { ValidationError } from '../../../../domain/errors/ValidationError.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeMockRes() {
  const written: string[] = [];
  const res: Partial<Response> & {
    _written: string[];
    _ended: boolean;
    _headers: Record<string, string>;
  } = {
    _written: written,
    _ended: false,
    _headers: {},
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockImplementation(function (key: string, val: string) {
      res._headers[key] = val;
      return res;
    }),
    flushHeaders: vi.fn(),
    write: vi.fn().mockImplementation((chunk: string) => {
      written.push(chunk);
      return true;
    }),
    end: vi.fn().mockImplementation(() => {
      res._ended = true;
    }),
  };
  return res;
}

function makeQueueEvents() {
  const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  const emit = (event: string, ...args: unknown[]) => {
    for (const h of handlers[event] ?? []) h(...args);
  };
  return {
    emit,
    queueEvents: {
      onJobActive: vi.fn().mockImplementation((h: unknown) => {
        if (!handlers['active']) handlers['active'] = [];
        handlers['active'].push(h as (...args: unknown[]) => void);
      }),
      onJobCompleted: vi.fn().mockImplementation((h: unknown) => {
        if (!handlers['completed']) handlers['completed'] = [];
        handlers['completed'].push(h as (...args: unknown[]) => void);
      }),
      onJobFailed: vi.fn().mockImplementation((h: unknown) => {
        if (!handlers['failed']) handlers['failed'] = [];
        handlers['failed'].push(h as (...args: unknown[]) => void);
      }),
      close: vi.fn().mockResolvedValue(undefined),
    },
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('JobController', () => {
  let controller: JobController;
  let mockContainer: Container;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  const mockJobQueue = {
    enqueue: vi.fn(),
    getStatus: vi.fn(),
    cancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockContainer = {
      jobQueue: mockJobQueue,
    } as unknown as Container;

    controller = new JobController(mockContainer);

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  // ─── getStatus ────────────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('should return job status when job exists', async () => {
      mockReq = { params: { jobId: 'job-abc-123' } };

      mockJobQueue.getStatus.mockResolvedValue({
        jobId: 'job-abc-123',
        status: 'processing',
      });

      await controller.getStatus(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { jobId: 'job-abc-123', status: 'processing' },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 404 when job is not found', async () => {
      mockReq = { params: { jobId: 'non-existent' } };

      mockJobQueue.getStatus.mockResolvedValue(null);

      await controller.getStatus(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'NOT_FOUND' }),
        })
      );
    });

    it('should throw ValidationError when jobId is missing', async () => {
      mockReq = { params: {} };

      await controller.getStatus(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('should return queued status', async () => {
      mockReq = { params: { jobId: 'job-queued' } };

      mockJobQueue.getStatus.mockResolvedValue({
        jobId: 'job-queued',
        status: 'queued',
      });

      await controller.getStatus(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ status: 'queued' }),
        })
      );
    });

    it('should return completed status', async () => {
      mockReq = { params: { jobId: 'job-done' } };

      mockJobQueue.getStatus.mockResolvedValue({
        jobId: 'job-done',
        status: 'completed',
      });

      await controller.getStatus(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'completed' }),
        })
      );
    });

    it('should call next with error on unexpected failure', async () => {
      mockReq = { params: { jobId: 'job-error' } };

      const unexpectedError = new Error('Redis connection lost');
      mockJobQueue.getStatus.mockRejectedValue(unexpectedError);

      await controller.getStatus(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(unexpectedError);
    });
  });

  // ─── streamEvents ─────────────────────────────────────────────────────────

  describe('streamEvents', () => {
    it('envía headers SSE correctos', async () => {
      const res = makeMockRes();
      const { queueEvents } = makeQueueEvents();
      mockJobQueue.getStatus.mockResolvedValue({ jobId: 'job-1', status: 'queued' });
      mockContainer = { jobQueue: mockJobQueue, queueEvents } as unknown as Container;
      controller = new JobController(mockContainer);

      const req = {
        params: { jobId: 'job-1' },
        on: vi.fn(),
      } as unknown as Request;

      await controller.streamEvents(req, res as unknown as Response);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(res.flushHeaders).toHaveBeenCalled();
    });

    it('envía snapshot inicial de estado', async () => {
      const res = makeMockRes();
      const { queueEvents } = makeQueueEvents();
      mockJobQueue.getStatus.mockResolvedValue({ jobId: 'job-1', status: 'queued' });
      mockContainer = { jobQueue: mockJobQueue, queueEvents } as unknown as Container;
      controller = new JobController(mockContainer);

      const req = { params: { jobId: 'job-1' }, on: vi.fn() } as unknown as Request;
      await controller.streamEvents(req, res as unknown as Response);

      expect(res._written[0]).toContain('"status":"queued"');
      expect(res._written[0]).toContain('"jobId":"job-1"');
    });

    it('cierra inmediatamente si el job ya está completado', async () => {
      const res = makeMockRes();
      const { queueEvents } = makeQueueEvents();
      mockJobQueue.getStatus.mockResolvedValue({ jobId: 'job-done', status: 'completed' });
      mockContainer = { jobQueue: mockJobQueue, queueEvents } as unknown as Container;
      controller = new JobController(mockContainer);

      const req = { params: { jobId: 'job-done' }, on: vi.fn() } as unknown as Request;
      await controller.streamEvents(req, res as unknown as Response);

      expect(res._ended).toBe(true);
      expect(queueEvents.onJobActive).not.toHaveBeenCalled();
    });

    it('cierra inmediatamente si el job ya está fallido', async () => {
      const res = makeMockRes();
      const { queueEvents } = makeQueueEvents();
      mockJobQueue.getStatus.mockResolvedValue({ jobId: 'job-fail', status: 'failed' });
      mockContainer = { jobQueue: mockJobQueue, queueEvents } as unknown as Container;
      controller = new JobController(mockContainer);

      const req = { params: { jobId: 'job-fail' }, on: vi.fn() } as unknown as Request;
      await controller.streamEvents(req, res as unknown as Response);

      expect(res._ended).toBe(true);
    });

    it('retorna error 404 si el job no existe', async () => {
      const res = makeMockRes();
      const { queueEvents } = makeQueueEvents();
      mockJobQueue.getStatus.mockResolvedValue(null);
      mockContainer = { jobQueue: mockJobQueue, queueEvents } as unknown as Container;
      controller = new JobController(mockContainer);

      const req = { params: { jobId: 'no-existe' }, on: vi.fn() } as unknown as Request;
      await controller.streamEvents(req, res as unknown as Response);

      const output = res._written.join('');
      expect(output).toContain('event: error');
      expect(output).toContain('"message"');
      expect(res._ended).toBe(true);
    });

    it('suscribe a QueueEvents cuando el job está en progreso', async () => {
      const res = makeMockRes();
      const { queueEvents } = makeQueueEvents();
      mockJobQueue.getStatus.mockResolvedValue({ jobId: 'job-active', status: 'processing' });
      mockContainer = { jobQueue: mockJobQueue, queueEvents } as unknown as Container;
      controller = new JobController(mockContainer);

      const req = { params: { jobId: 'job-active' }, on: vi.fn() } as unknown as Request;
      await controller.streamEvents(req, res as unknown as Response);

      expect(queueEvents.onJobActive).toHaveBeenCalled();
      expect(queueEvents.onJobCompleted).toHaveBeenCalled();
      expect(queueEvents.onJobFailed).toHaveBeenCalled();
    });

    it('envía evento completed y cierra cuando BullMQ emite completed', async () => {
      const res = makeMockRes();
      const { queueEvents, emit } = makeQueueEvents();
      mockJobQueue.getStatus.mockResolvedValue({ jobId: 'job-q', status: 'queued' });
      mockContainer = { jobQueue: mockJobQueue, queueEvents } as unknown as Container;
      controller = new JobController(mockContainer);

      const req = { params: { jobId: 'job-q' }, on: vi.fn() } as unknown as Request;
      await controller.streamEvents(req, res as unknown as Response);

      // Simular evento completed de BullMQ
      emit('completed', 'job-q');

      const output = res._written.join('');
      expect(output).toContain('"status":"completed"');
      expect(res._ended).toBe(true);
    });

    it('envía evento failed y cierra cuando BullMQ emite failed', async () => {
      const res = makeMockRes();
      const { queueEvents, emit } = makeQueueEvents();
      mockJobQueue.getStatus.mockResolvedValue({ jobId: 'job-q2', status: 'queued' });
      mockContainer = { jobQueue: mockJobQueue, queueEvents } as unknown as Container;
      controller = new JobController(mockContainer);

      const req = { params: { jobId: 'job-q2' }, on: vi.fn() } as unknown as Request;
      await controller.streamEvents(req, res as unknown as Response);

      emit('failed', 'job-q2', 'Python worker crashed');

      const output = res._written.join('');
      expect(output).toContain('"status":"failed"');
      expect(output).toContain('"error":"Python worker crashed"');
      expect(res._ended).toBe(true);
    });

    it('ignora eventos de otros jobs', async () => {
      const res = makeMockRes();
      const { queueEvents, emit } = makeQueueEvents();
      mockJobQueue.getStatus.mockResolvedValue({ jobId: 'job-mine', status: 'queued' });
      mockContainer = { jobQueue: mockJobQueue, queueEvents } as unknown as Container;
      controller = new JobController(mockContainer);

      const req = { params: { jobId: 'job-mine' }, on: vi.fn() } as unknown as Request;
      await controller.streamEvents(req, res as unknown as Response);

      // Evento de OTRO job
      emit('completed', 'job-otro');

      expect(res._ended).toBe(false);
    });

    it('retorna 400 si no se proporciona jobId', async () => {
      const res = makeMockRes();
      const req = { params: {}, on: vi.fn() } as unknown as Request;
      await controller.streamEvents(req, res as unknown as Response);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
