import type { PrismaClient, User as PrismaUser } from '@prisma/client';
import type {
  UserRepository,
  CreateUserData,
  UpdateUserData,
} from '../../../domain/ports/repositories/UserRepository.js';
import { User, type UserRole } from '../../../domain/entities/User.js';

/**
 * Prisma implementation of UserRepository.
 */
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(user: User): Promise<void> {
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        email: user.email,
        name: user.name,
        role: user.role,
        preferences: user.preferences as Record<string, never>,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!record) return null;

    return this.toDomain(record);
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!record) return null;

    return this.toDomain(record);
  }

  async findByEmailWithPassword(email: string): Promise<(User & { passwordHash: string }) | null> {
    const record = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!record) return null;

    const user = this.toDomain(record);
    return Object.assign(user, { passwordHash: record.passwordHash });
  }

  async create(data: CreateUserData): Promise<User> {
    const record = await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash: data.passwordHash,
        role: data.role ?? 'USER',
      },
    });

    return this.toDomain(record);
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    const record = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.passwordHash !== undefined ? { passwordHash: data.passwordHash } : {}),
      },
    });

    return this.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({
      where: { id },
    });
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { id },
    });
    return count > 0;
  }

  // ─────────────────────────────────────────────────────────────
  // Mapping helpers
  // ─────────────────────────────────────────────────────────────

  private toDomain(record: PrismaUser): User {
    return User.reconstitute({
      id: record.id,
      email: record.email,
      name: record.name,
      role: record.role as UserRole,
      preferences: record.preferences as Record<string, unknown>,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      lastLoginAt: record.lastLoginAt,
    });
  }
}
