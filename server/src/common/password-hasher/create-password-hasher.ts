import { IPasswordHasher } from './password-hasher.interface';
import { BcryptPasswordHasher } from './bcrypt-password-hasher';

interface CreatePasswordHasherConfig {
  saltRounds: number;
}

export function createPasswordHasher(config: CreatePasswordHasherConfig): IPasswordHasher {
  return new BcryptPasswordHasher(config.saltRounds);
}
