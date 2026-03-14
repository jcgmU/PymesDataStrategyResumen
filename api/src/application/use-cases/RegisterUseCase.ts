import type { UserRepository } from '../../domain/ports/repositories/UserRepository.js';
import type { IPasswordService } from '../../domain/ports/services/PasswordService.js';
import { ValidationError } from '../../domain/errors/ValidationError.js';

/**
 * Input DTO for the register use case.
 */
export interface RegisterInput {
  email: string;
  name: string;
  password: string;
}

/**
 * Output DTO for the register use case.
 */
export interface RegisterOutput {
  id: string;
  email: string;
  name: string;
}

/**
 * Use case for registering a new user.
 *
 * Flow:
 * 1. Check if email is already in use
 * 2. Hash the password
 * 3. Create the user in the repository
 * 4. Return user info (no token — user must login separately)
 */
export class RegisterUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordService: IPasswordService
  ) {}

  async execute(input: RegisterInput): Promise<RegisterOutput> {
    // 1. Check if email already exists
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing !== null) {
      throw new ValidationError('Email already in use', 'email');
    }

    // 2. Hash password
    const passwordHash = await this.passwordService.hash(input.password);

    // 3. Create user
    const user = await this.userRepository.create({
      email: input.email,
      name: input.name,
      passwordHash,
    });

    // 4. Return user info
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? '',
    };
  }
}
