import { env } from '@/config/env';
import { CryptoActivationTokenService } from './crypto-activation-token.service';

export * from './activation-token.interface';
export * from './activation-token.types';
export * from './crypto-activation-token.service';

export const activationTokenService = CryptoActivationTokenService.create({
  ttlSeconds: env.ACTIVATION_TOKEN_TTL_SECONDS,
});
