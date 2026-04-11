import bcrypt from 'bcrypt';
import { IPasswordHasher } from './password-hasher.interface';
import { BcryptPasswordHasherConfig } from './bcrypt-password-hasher.types';

export class BcryptPasswordHasher implements IPasswordHasher {
  private readonly saltRounds: number;

  private constructor(saltRounds: number) {
    this.saltRounds = saltRounds;
  }

  public static create(config: BcryptPasswordHasherConfig): BcryptPasswordHasher {
    return new BcryptPasswordHasher(config.saltRounds);
  }

  hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }
}
