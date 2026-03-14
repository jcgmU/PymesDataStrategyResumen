import type { UserRepository } from '../../domain/ports/repositories/UserRepository.js';
import { NotFoundError } from '../../domain/errors/NotFoundError.js';

/**
 * Output DTO for get current user.
 */
export interface GetCurrentUserOutput {
  id: string;
  email: string;
  name: string;
  role: string;
}

/**
 * Use case for retrieving the current authenticated user's profile.
 */
export class GetCurrentUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(userId: string): Promise<GetCurrentUserOutput> {
    const user = await this.userRepository.findById(userId);
    if (user === null) {
      throw new NotFoundError('User', userId);
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name ?? '',
      role: user.role,
    };
  }
}
