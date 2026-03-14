import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { GetCurrentUserUseCase } from '../GetCurrentUserUseCase.js';
import type { UserRepository } from '../../../domain/ports/repositories/UserRepository.js';
import { NotFoundError } from '../../../domain/errors/NotFoundError.js';
import { User } from '../../../domain/entities/User.js';

function createMockUserRepository(): UserRepository & {
  save: Mock;
  findById: Mock;
  findByEmail: Mock;
  findByEmailWithPassword: Mock;
  create: Mock;
  update: Mock;
  delete: Mock;
  exists: Mock;
} {
  return {
    save: vi.fn(),
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findByEmailWithPassword: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
  };
}

function createSampleUser(role: 'ADMIN' | 'USER' | 'VIEWER' = 'USER'): User {
  return User.reconstitute({
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role,
    preferences: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
  });
}

describe('GetCurrentUserUseCase', () => {
  let useCase: GetCurrentUserUseCase;
  let mockUserRepository: ReturnType<typeof createMockUserRepository>;

  beforeEach(() => {
    mockUserRepository = createMockUserRepository();
    mockUserRepository.findById.mockResolvedValue(createSampleUser());
    useCase = new GetCurrentUserUseCase(mockUserRepository);
  });

  describe('execute', () => {
    it('should return user profile for valid userId', async () => {
      const result = await useCase.execute('user-123');

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
      });
    });

    it('should look up user by id', async () => {
      await useCase.execute('user-123');

      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
    });

    it('should throw NotFoundError if user does not exist', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute('non-existent')).rejects.toThrow(NotFoundError);

      await expect(useCase.execute('non-existent')).rejects.toMatchObject({
        entityType: 'User',
        entityId: 'non-existent',
      });
    });

    it('should include user role in output', async () => {
      mockUserRepository.findById.mockResolvedValue(createSampleUser('ADMIN'));

      const result = await useCase.execute('user-123');

      expect(result.role).toBe('ADMIN');
    });
  });
});
