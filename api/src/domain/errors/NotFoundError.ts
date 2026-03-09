import { DomainError } from './DomainError.js';

/**
 * Error thrown when a requested entity is not found.
 */
export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  readonly entityType: string;
  readonly entityId: string;

  constructor(entityType: string, entityId: string) {
    super(`${entityType} with id '${entityId}' not found`);
    this.entityType = entityType;
    this.entityId = entityId;
  }

  override toJSON(): {
    code: string;
    message: string;
    name: string;
    entityType: string;
    entityId: string;
  } {
    return {
      ...super.toJSON(),
      entityType: this.entityType,
      entityId: this.entityId,
    };
  }
}
