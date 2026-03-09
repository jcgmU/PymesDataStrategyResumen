import { randomUUID } from 'node:crypto';

/**
 * Value object representing a Dataset identifier.
 * Ensures type safety and encapsulates ID generation logic.
 */
export class DatasetId {
  private constructor(private readonly value: string) {}

  static generate(): DatasetId {
    return new DatasetId(randomUUID());
  }

  static fromString(id: string): DatasetId {
    if (!id || id.trim() === '') {
      throw new Error('DatasetId cannot be empty');
    }
    return new DatasetId(id);
  }

  toString(): string {
    return this.value;
  }

  equals(other: DatasetId): boolean {
    return this.value === other.value;
  }
}
