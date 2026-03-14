import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { UpdateUserUseCase } from '../UpdateUserUseCase.js';
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

function createSampleUser(overrides: Partial<{ name: string; email: string }> = {}): User {
  return User.reconstitute({
    id: 'user-123',
    email: overrides.email ?? 'test@example.com',
    name: overrides.name ?? 'Test User',
    role: 'USER',
    preferences: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
  });
}

describe('UpdateUserUseCase', () => {
  let useCase: UpdateUserUseCase;
  let mockUserRepository: ReturnType<typeof createMockUserRepository>;

  beforeEach(() => {
    mockUserRepository = createMockUserRepository();
    mockUserRepository.findById.mockResolvedValue(createSampleUser());
    mockUserRepository.update.mockResolvedValue(
      createSampleUser({ name: 'Updated Name' })
    );
    useCase = new UpdateUserUseCase(mockUserRepository);
  });

  describe('execute', () => {
    it('should update user name successfully', async () => {
      mockUserRepository.update.mockResolvedValue(
        createSampleUser({ name: 'New Name' })
      );

      const result = await useCase.execute({ userId: 'user-123', name: 'New Name' });

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'New Name',
      });
    });

    it('should update user email successfully', async () => {
      mockUserRepository.update.mockResolvedValue(
        createSampleUser({ email: 'new@example.com' })
      );

      const result = await useCase.execute({ userId: 'user-123', email: 'new@example.com' });

      expect(result.email).toBe('new@example.com');
    });

    it('should throw NotFoundError if user does not exist', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({ userId: 'non-existent', name: 'Test' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should only pass provided fields to the repository', async () => {
      await useCase.execute({ userId: 'user-123', name: 'Only Name' });

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        'user-123',
        { name: 'Only Name' }
      );
    });

    it('should pass email if provided', async () => {
      await useCase.execute({ userId: 'user-123', email: 'only@example.com' });

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        'user-123',
        { email: 'only@example.com' }
      );
    });

    it('should verify user exists before updating', async () => {
      await useCase.execute({ userId: 'user-123', name: 'Test' });

      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123');
    });

    it('should propagate repository errors', async () => {
      mockUserRepository.update.mockRejectedValue(new Error('Database error'));

      await expect(
        useCase.execute({ userId: 'user-123', name: 'Test' })
      ).rejects.toThrow('Database error');
    });
  });
});
