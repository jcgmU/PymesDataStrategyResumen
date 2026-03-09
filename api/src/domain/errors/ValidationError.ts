import { DomainError } from './DomainError.js';

/**
 * Error thrown when input validation fails.
 */
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly field: string | undefined;

  constructor(message: string, field?: string) {
    super(message);
    this.field = field;
  }

  override toJSON(): { code: string; message: string; name: string; field?: string | undefined } {
    const base = super.toJSON();
    if (this.field !== undefined) {
      return { ...base, field: this.field };
    }
    return base;
  }
}
