import type { User } from '../../entities/User.js';

/**
 * Port for User persistence operations.
 * Infrastructure layer must implement this interface.
 */
export interface UserRepository {
  save(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}
