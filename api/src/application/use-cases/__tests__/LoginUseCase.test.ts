import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { LoginUseCase } from '../LoginUseCase.js';
import type { UserRepository } from '../../../domain/ports/repositories/UserRepository.js';
import type { IPasswordService } from '../../../domain/ports/services/PasswordService.js';
import type { IJwtService } from '../../../domain/ports/services/JwtService.js';
import { NotFoundError } from '../../../domain/errors/NotFoundError.js';
import { ValidationError } from '../../../domain/errors/ValidationError.js';
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

function createMockPasswordService(): IPasswordService & {
  hash: Mock;
  compare: Mock;
} {
  return {
    hash: vi.fn(),
    compare: vi.fn(),
  };
}

function createMockJwtService(): IJwtService & {
  sign: Mock;
  verify: Mock;
} {
  return {
    sign: vi.fn(),
    verify: vi.fn(),
  };
}

function createSampleUserWithPassword(): User & { passwordHash: string } {
  const user = User.reconstitute({
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'USER',
    preferences: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
  });
  return Object.assign(user, { passwordHash: 'hashed-password' });
}

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let mockUserRepository: ReturnType<typeof createMockUserRepository>;
  let mockPasswordService: ReturnType<typeof createMockPasswordService>;
  let mockJwtService: ReturnType<typeof createMockJwtService>;

  beforeEach(() => {
    mockUserRepository = createMockUserRepository();
    mockPasswordService = createMockPasswordService();
    mockJwtService = createMockJwtService();

    mockUserRepository.findByEmailWithPassword.mockResolvedValue(createSampleUserWithPassword());
    mockPasswordService.compare.mockResolvedValue(true);
    mockJwtService.sign.mockReturnValue('jwt-token-abc123');

    useCase = new LoginUseCase(mockUserRepository, mockPasswordService, mockJwtService);
  });

  describe('execute', () => {
    it('should return user and accessToken on successful login', async () => {
      const result = await useCase.execute({
        email: 'test@example.com',
        password: 'correctpassword',
      });

      expect(result).toEqual({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        },
        accessToken: 'jwt-token-abc123',
      });
    });

    it('should look up user by email with password', async () => {
      await useCase.execute({ email: 'test@example.com', password: 'pass' });

      expect(mockUserRepository.findByEmailWithPassword).toHaveBeenCalledWith('test@example.com');
    });

    it('should throw NotFoundError if user does not exist', async () => {
      mockUserRepository.findByEmailWithPassword.mockResolvedValue(null);

      await expect(
        useCase.execute({ email: 'unknown@example.com', password: 'pass' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError if password is incorrect', async () => {
      mockPasswordService.compare.mockResolvedValue(false);

      await expect(
        useCase.execute({ email: 'test@example.com', password: 'wrongpassword' })
      ).rejects.toThrow(ValidationError);

      await expect(
        useCase.execute({ email: 'test@example.com', password: 'wrongpassword' })
      ).rejects.toMatchObject({ field: 'password' });
    });

    it('should compare password with stored hash', async () => {
      await useCase.execute({ email: 'test@example.com', password: 'mypassword' });

      expect(mockPasswordService.compare).toHaveBeenCalledWith('mypassword', 'hashed-password');
    });

    it('should sign JWT with user id and email', async () => {
      await useCase.execute({ email: 'test@example.com', password: 'pass' });

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        userId: 'user-123',
        email: 'test@example.com',
      });
    });
  });
});
