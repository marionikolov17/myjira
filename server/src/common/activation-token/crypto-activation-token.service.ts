import crypto from 'crypto';
import { IActivationTokenService } from './activation-token.interface';
import { ActivationToken, CryptoActivationTokenServiceConfig } from './activation-token.types';

const TOKEN_BYTE_LENGTH = 32;

export class CryptoActivationTokenService implements IActivationTokenService {
  private constructor(private readonly ttlSeconds: number) {}

  public static create(config: CryptoActivationTokenServiceConfig): CryptoActivationTokenService {
    return new CryptoActivationTokenService(config.ttlSeconds);
  }

  public generate(): ActivationToken {
    const token = crypto.randomBytes(TOKEN_BYTE_LENGTH).toString('base64url');
    const tokenHash = this.hash(token);
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);

    return { token, tokenHash, expiresAt };
  }

  public hash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
