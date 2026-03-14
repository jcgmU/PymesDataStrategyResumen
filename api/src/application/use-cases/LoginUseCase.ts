import type { UserRepository } from '../../domain/ports/repositories/UserRepository.js';
import type { IPasswordService } from '../../domain/ports/services/PasswordService.js';
import type { IJwtService } from '../../domain/ports/services/JwtService.js';
import { NotFoundError } from '../../domain/errors/NotFoundError.js';
import { ValidationError } from '../../domain/errors/ValidationError.js';

/**
 * Input DTO for the login use case.
 */
export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Output DTO for the login use case.
 */
export interface LoginOutput {
  user: {
    id: string;
    email: string;
    name: string;
  };
  accessToken: string;
}

/**
 * Use case for authenticating a user.
 *
 * Flow:
 * 1. Find user by email (with password hash)
 * 2. Compare password
 * 3. Generate JWT access token
 * 4. Return user info and token
 */
export class LoginUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordService: IPasswordService,
    private readonly jwtService: IJwtService
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    // 1. Find user by email (includes passwordHash)
    const userWithPassword = await this.userRepository.findByEmailWithPassword(input.email);
    if (userWithPassword === null) {
      throw new NotFoundError('User', input.email);
    }

    // 2. Compare password
    const isValid = await this.passwordService.compare(input.password, userWithPassword.passwordHash);
    if (!isValid) {
      throw new ValidationError('Invalid credentials', 'password');
    }

    // 3. Generate JWT
    const accessToken = this.jwtService.sign({
      userId: userWithPassword.id,
      email: userWithPassword.email,
    });

    // 4. Return result
    return {
      user: {
        id: userWithPassword.id,
        email: userWithPassword.email,
        name: userWithPassword.name ?? '',
      },
      accessToken,
    };
  }
}
