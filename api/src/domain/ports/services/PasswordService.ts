/**
 * Port for password hashing operations.
 * Infrastructure layer must implement this interface.
 */
export interface IPasswordService {
  hash(password: string): Promise<string>;
  compare(password: string, hash: string): Promise<boolean>;
}
