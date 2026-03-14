import type { User } from '../../entities/User.js';

/**
 * Input DTO for creating a user in the repository.
 */
export interface CreateUserData {
  email: string;
  name: string;
  passwordHash: string;
  role?: User['role'];
}

/**
 * Input DTO for updating a user in the repository.
 */
export interface UpdateUserData {
  name?: string;
  email?: string;
  passwordHash?: string;
}

/**
 * Port for User persistence operations.
 * Infrastructure layer must implement this interface.
 */
export interface UserRepository {
  save(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByEmailWithPassword(email: string): Promise<(User & { passwordHash: string }) | null>;
  create(data: CreateUserData): Promise<User>;
  update(id: string, data: UpdateUserData): Promise<User>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}
