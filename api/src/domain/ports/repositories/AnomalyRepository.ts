import type { Anomaly } from '../../entities/Anomaly.js';

/**
 * Port for Anomaly persistence operations.
 * Infrastructure layer must implement this interface.
 */
export interface AnomalyRepository {
  findByDatasetId(datasetId: string): Promise<Anomaly[]>;
  findById(id: string): Promise<Anomaly | null>;
  save(anomaly: Anomaly): Promise<void>;
  saveMany(anomalies: Anomaly[]): Promise<void>;
}
