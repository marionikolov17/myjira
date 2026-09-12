import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { CryptoActivationTokenService } from '@/common/activation-token/crypto-activation-token.service';
import { IActivationTokenService } from '@/common/activation-token/activation-token.interface';

const TTL_SECONDS = 3600;

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

describe('CryptoActivationTokenService', () => {
  let service: IActivationTokenService;

  beforeEach(() => {
    service = CryptoActivationTokenService.create({ ttlSeconds: TTL_SECONDS });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('hash', () => {
    it('returns the deterministic sha256 hex digest of the token', () => {
      const token = 'a-raw-activation-token';

      expect(service.hash(token)).toBe(sha256Hex(token));
    });

    it('is deterministic across calls for the same token', () => {
      const token = 'another-token';

      expect(service.hash(token)).toBe(service.hash(token));
    });

    it('produces different hashes for different tokens', () => {
      expect(service.hash('token-a')).not.toBe(service.hash('token-b'));
    });
  });

  describe('generate', () => {
    it('stores a hash equal to sha256(token)', () => {
      const { token, tokenHash } = service.generate();

      expect(tokenHash).toBe(sha256Hex(token));
    });

    it('never exposes the raw token inside its own hash', () => {
      const { token, tokenHash } = service.generate();

      expect(tokenHash).not.toContain(token);
    });

    it('produces unique tokens across calls', () => {
      const tokens = new Set(Array.from({ length: 50 }, () => service.generate().token));

      expect(tokens.size).toBe(50);
    });

    it('produces unique hashes across calls', () => {
      const hashes = new Set(Array.from({ length: 50 }, () => service.generate().tokenHash));

      expect(hashes.size).toBe(50);
    });

    it('sets expiresAt to now plus the configured TTL', () => {
      const now = new Date('2026-01-01T00:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);

      try {
        const { expiresAt } = service.generate();

        expect(expiresAt.getTime()).toBe(now.getTime() + TTL_SECONDS * 1000);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
