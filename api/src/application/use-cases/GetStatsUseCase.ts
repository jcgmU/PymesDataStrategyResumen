import type { IStatsRepository, Stats } from '../../domain/ports/repositories/StatsRepository.js';

/**
 * Use case for retrieving aggregated statistics for the authenticated user.
 *
 * Flow:
 * 1. Delegate to the stats repository to aggregate metrics
 * 2. Return the Stats DTO directly
 */
export class GetStatsUseCase {
  constructor(private readonly statsRepository: IStatsRepository) {}

  async execute(userId: string): Promise<Stats> {
    return this.statsRepository.getStats(userId);
  }
}
