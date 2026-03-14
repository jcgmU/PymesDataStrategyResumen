/**
 * Port for JWT token operations.
 * Infrastructure layer must implement this interface.
 */
export interface JwtPayload {
  userId: string;
  email: string;
}

export interface IJwtService {
  sign(payload: JwtPayload): string;
  verify(token: string): JwtPayload;
}
