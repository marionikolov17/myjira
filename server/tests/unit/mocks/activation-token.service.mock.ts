import { jest } from '@jest/globals';
import { IActivationTokenService } from '@/common/activation-token';

export function createMockActivationTokenService(): jest.Mocked<IActivationTokenService> {
  return {
    generate: jest.fn(),
    hash: jest.fn(),
  };
}
