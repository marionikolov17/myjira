import { env } from '@/config/env';
import { createPasswordHasher } from './create-password-hasher';

export const passwordHasher = createPasswordHasher({
  saltRounds: env.SALT_ROUNDS,
});
