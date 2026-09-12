export interface ActivationToken {
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface CryptoActivationTokenServiceConfig {
  ttlSeconds: number;
}
