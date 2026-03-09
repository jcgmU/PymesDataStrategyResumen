export interface UserProps {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  preferences: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export type UserRole = 'ADMIN' | 'USER' | 'VIEWER';

export class User {
  private constructor(private readonly props: UserProps) {}

  static create(props: Omit<UserProps, 'id' | 'createdAt' | 'updatedAt' | 'lastLoginAt'> & { id: string }): User {
    return new User({
      ...props,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
    });
  }

  static reconstitute(props: UserProps): User {
    return new User(props);
  }

  get id(): string {
    return this.props.id;
  }

  get email(): string {
    return this.props.email;
  }

  get name(): string | null {
    return this.props.name;
  }

  get role(): UserRole {
    return this.props.role;
  }

  get preferences(): Record<string, unknown> {
    return { ...this.props.preferences };
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get lastLoginAt(): Date | null {
    return this.props.lastLoginAt;
  }

  isAdmin(): boolean {
    return this.props.role === 'ADMIN';
  }

  canEdit(): boolean {
    return this.props.role === 'ADMIN' || this.props.role === 'USER';
  }

  recordLogin(): void {
    this.props.lastLoginAt = new Date();
    this.props.updatedAt = new Date();
  }

  updatePreferences(preferences: Record<string, unknown>): void {
    this.props.preferences = preferences;
    this.props.updatedAt = new Date();
  }
}
