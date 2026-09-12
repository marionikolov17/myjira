import { ActivationToken } from './activation-token.types';

export interface IActivationTokenService {
  /**
   * Generates a fresh single-use activation token together with its
   * deterministic hash and an expiry derived from the configured TTL.
   */
  generate(): ActivationToken;

  /**
   * Computes the deterministic hash (sha256 hex) of a raw token so it can be
   * looked up during activation.
   */
  hash(token: string): string;
}
