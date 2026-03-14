import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BullMQQueueEvents, type QueueEventsLike } from '../BullMQQueueEvents.js';

/**
 * Creates a mock QueueEventsLike that captures registered handlers.
 */
function makeMockQueueEvents() {
  const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};

  const mock: QueueEventsLike = {
    on(event: string, handler: (...args: unknown[]) => void) {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
      return mock;
    },
    off(event: string, handler: (...args: unknown[]) => void) {
      handlers[event] = (handlers[event] ?? []).filter((h) => h !== handler);
      return mock;
    },
    close: vi.fn().mockResolvedValue(undefined),
  };

  const emit = (event: string, ...args: unknown[]) => {
    for (const h of handlers[event] ?? []) h(...args);
  };

  return { mock, emit, handlers };
}

describe('BullMQQueueEvents', () => {
  let qe: BullMQQueueEvents;
  let emit: (event: string, ...args: unknown[]) => void;
  let mockInstance: QueueEventsLike;

  beforeEach(() => {
    const { mock, emit: e } = makeMockQueueEvents();
    mockInstance = mock;
    emit = e;
    qe = BullMQQueueEvents.withInstance(mock);
  });

  it('llama al handler onJobActive cuando un job se activa', () => {
    const handler = vi.fn();
    qe.onJobActive(handler);

    emit('active', { jobId: 'job-123' });

    expect(handler).toHaveBeenCalledWith('job-123');
  });

  it('llama al handler onJobCompleted cuando un job completa', () => {
    const handler = vi.fn();
    qe.onJobCompleted(handler);

    emit('completed', { jobId: 'job-456' });

    expect(handler).toHaveBeenCalledWith('job-456');
  });

  it('llama al handler onJobFailed con jobId y motivo', () => {
    const handler = vi.fn();
    qe.onJobFailed(handler);

    emit('failed', { jobId: 'job-789', failedReason: 'timeout error' });

    expect(handler).toHaveBeenCalledWith('job-789', 'timeout error');
  });

  it('no llama al handler de otro evento', () => {
    const completedHandler = vi.fn();
    const failedHandler = vi.fn();
    qe.onJobCompleted(completedHandler);
    qe.onJobFailed(failedHandler);

    emit('active', { jobId: 'job-000' });

    expect(completedHandler).not.toHaveBeenCalled();
    expect(failedHandler).not.toHaveBeenCalled();
  });

  it('llama a close en el QueueEvents subyacente', async () => {
    await qe.close();
    expect(mockInstance.close).toHaveBeenCalled();
  });

  it('soporta múltiples handlers para el mismo evento', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    qe.onJobCompleted(h1);
    qe.onJobCompleted(h2);

    emit('completed', { jobId: 'job-multi' });

    expect(h1).toHaveBeenCalledWith('job-multi');
    expect(h2).toHaveBeenCalledWith('job-multi');
  });
});
