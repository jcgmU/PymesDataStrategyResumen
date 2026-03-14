import type { UserRepository } from '../../domain/ports/repositories/UserRepository.js';
import { NotFoundError } from '../../domain/errors/NotFoundError.js';

/**
 * Input DTO for updating user profile.
 */
export interface UpdateUserInput {
  userId: string;
  name?: string;
  email?: string;
}

/**
 * Output DTO for update user.
 */
export interface UpdateUserOutput {
  id: string;
  email: string;
  name: string;
}

/**
 * Use case for updating the current user's profile.
 */
export class UpdateUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: UpdateUserInput): Promise<UpdateUserOutput> {
    // Verify user exists
    const existing = await this.userRepository.findById(input.userId);
    if (existing === null) {
      throw new NotFoundError('User', input.userId);
    }

    // Build partial update (only include provided fields)
    const updateData: { name?: string; email?: string } = {};
    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.email !== undefined) {
      updateData.email = input.email;
    }

    const updated = await this.userRepository.update(input.userId, updateData);

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name ?? '',
    };
  }
}
