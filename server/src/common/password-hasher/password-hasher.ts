import { env } from '@/config/env';
import { BcryptPasswordHasher } from './bcrypt-password-hasher';

export const passwordHasher = BcryptPasswordHasher.create({
  saltRounds: env.SALT_ROUNDS,
});
