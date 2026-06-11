import { env } from '@/config/env';
import { JsonwebtokenTokenService } from './jsonwebtoken-token-service';

export const tokenService = JsonwebtokenTokenService.create({
  secretKey: env.JWT_SECRET_KEY,
  expiresIn: env.JWT_EXPIRES_IN,
});
