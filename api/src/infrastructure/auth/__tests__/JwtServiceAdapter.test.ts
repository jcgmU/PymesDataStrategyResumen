import { describe, it, expect, beforeEach } from 'vitest';
import { JwtServiceAdapter } from '../JwtServiceAdapter.js';
import { ValidationError } from '../../../domain/errors/ValidationError.js';

const TEST_SECRET = 'test-secret-key-for-unit-tests-only';
const TEST_EXPIRES_IN = '1h';

describe('JwtServiceAdapter', () => {
  let service: JwtServiceAdapter;

  beforeEach(() => {
    service = new JwtServiceAdapter(TEST_SECRET, TEST_EXPIRES_IN);
  });

  describe('sign', () => {
    it('should return a string token', () => {
      const token = service.sign({ userId: 'user-123', email: 'test@example.com' });

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate different tokens for different payloads', () => {
      const token1 = service.sign({ userId: 'user-1', email: 'user1@example.com' });
      const token2 = service.sign({ userId: 'user-2', email: 'user2@example.com' });

      expect(token1).not.toBe(token2);
    });

    it('should produce a JWT with three parts', () => {
      const token = service.sign({ userId: 'user-123', email: 'test@example.com' });
      const parts = token.split('.');

      expect(parts).toHaveLength(3);
    });
  });

  describe('verify', () => {
    it('should return the original payload from a valid token', () => {
      const payload = { userId: 'user-123', email: 'test@example.com' };
      const token = service.sign(payload);

      const decoded = service.verify(token);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
    });

    it('should throw ValidationError for an invalid token', () => {
      expect(() => service.verify('invalid.token.here')).toThrow(ValidationError);
    });

    it('should throw ValidationError for an empty token', () => {
      expect(() => service.verify('')).toThrow(ValidationError);
    });

    it('should throw ValidationError for a token signed with different secret', () => {
      const otherService = new JwtServiceAdapter('different-secret', TEST_EXPIRES_IN);
      const token = otherService.sign({ userId: 'user-123', email: 'test@example.com' });

      expect(() => service.verify(token)).toThrow(ValidationError);
    });

    it('should throw ValidationError for an expired token', async () => {
      const shortLivedService = new JwtServiceAdapter(TEST_SECRET, '1ms');
      const token = shortLivedService.sign({ userId: 'user-123', email: 'test@example.com' });

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(() => service.verify(token)).toThrow(ValidationError);
    });
  });
});
