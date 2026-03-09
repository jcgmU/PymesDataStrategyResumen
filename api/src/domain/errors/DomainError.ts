/**
 * Base class for all domain errors.
 * Allows distinguishing domain errors from infrastructure errors.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): { code: string; message: string; name: string } {
    return {
      code: this.code,
      message: this.message,
      name: this.name,
    };
  }
}
