import bcrypt from 'bcrypt';
import type { IPasswordService } from '../../domain/ports/services/PasswordService.js';

const SALT_ROUNDS = 10;

/**
 * Password service adapter using bcrypt.
 */
export class BcryptPasswordService implements IPasswordService {
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
