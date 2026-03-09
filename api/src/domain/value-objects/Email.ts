/**
 * Value object representing a validated email address.
 */
export class Email {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  private constructor(private readonly value: string) {}

  static create(email: string): Email {
    const normalized = email.toLowerCase().trim();

    if (!Email.EMAIL_REGEX.test(normalized)) {
      throw new Error(`Invalid email format: ${email}`);
    }

    return new Email(normalized);
  }

  static fromString(email: string): Email {
    return Email.create(email);
  }

  toString(): string {
    return this.value;
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  getDomain(): string {
    const parts = this.value.split('@');
    return parts[1] ?? '';
  }
}
