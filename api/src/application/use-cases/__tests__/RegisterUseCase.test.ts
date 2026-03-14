import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { RegisterUseCase } from '../RegisterUseCase.js';
import type { UserRepository } from '../../../domain/ports/repositories/UserRepository.js';
import type { IPasswordService } from '../../../domain/ports/services/PasswordService.js';
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

function createSampleUser(): User {
  return User.reconstitute({
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'USER',
    preferences: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
  });
}

describe('RegisterUseCase', () => {
  let useCase: RegisterUseCase;
  let mockUserRepository: ReturnType<typeof createMockUserRepository>;
  let mockPasswordService: ReturnType<typeof createMockPasswordService>;

  beforeEach(() => {
    mockUserRepository = createMockUserRepository();
    mockPasswordService = createMockPasswordService();

    // Default: email not taken
    mockUserRepository.findByEmail.mockResolvedValue(null);
    // Default: hash returns a value
    mockPasswordService.hash.mockResolvedValue('hashed-password-123');
    // Default: create returns a user
    mockUserRepository.create.mockResolvedValue(createSampleUser());

    useCase = new RegisterUseCase(mockUserRepository, mockPasswordService);
  });

  describe('execute', () => {
    it('should register a new user successfully', async () => {
      const result = await useCase.execute({
        email: 'test@example.com',
        name: 'Test User',
        password: 'securepassword',
      });

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      });
    });

    it('should check if email already exists', async () => {
      await useCase.execute({
        email: 'test@example.com',
        name: 'Test User',
        password: 'securepassword',
      });

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should throw ValidationError if email is already in use', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(createSampleUser());

      await expect(
        useCase.execute({ email: 'test@example.com', name: 'Test User', password: 'pass' })
      ).rejects.toThrow(ValidationError);

      await expect(
        useCase.execute({ email: 'test@example.com', name: 'Test User', password: 'pass' })
      ).rejects.toMatchObject({ field: 'email', message: 'Email already in use' });
    });

    it('should hash the password before storing', async () => {
      await useCase.execute({
        email: 'test@example.com',
        name: 'Test User',
        password: 'mysecretpassword',
      });

      expect(mockPasswordService.hash).toHaveBeenCalledWith('mysecretpassword');
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: 'hashed-password-123' })
      );
    });

    it('should create user with provided details', async () => {
      await useCase.execute({
        email: 'new@example.com',
        name: 'New User',
        password: 'password123',
      });

      expect(mockUserRepository.create).toHaveBeenCalledWith({
        email: 'new@example.com',
        name: 'New User',
        passwordHash: 'hashed-password-123',
      });
    });

    it('should propagate repository errors', async () => {
      mockUserRepository.create.mockRejectedValue(new Error('Database error'));

      await expect(
        useCase.execute({ email: 'test@example.com', name: 'Test', password: 'pass' })
      ).rejects.toThrow('Database error');
    });
  });
});
