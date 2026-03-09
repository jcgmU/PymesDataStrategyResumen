import type { Dataset } from '../../entities/Dataset.js';
import type { DatasetId } from '../../value-objects/DatasetId.js';

/**
 * Port for Dataset persistence operations.
 * Infrastructure layer must implement this interface.
 */
export interface DatasetRepository {
  save(dataset: Dataset): Promise<void>;
  findById(id: DatasetId): Promise<Dataset | null>;
  findByUserId(userId: string): Promise<Dataset[]>;
  delete(id: DatasetId): Promise<void>;
  exists(id: DatasetId): Promise<boolean>;
}
