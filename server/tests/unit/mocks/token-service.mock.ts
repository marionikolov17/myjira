import { ITokenService } from '@/common/token-service/token-service.interface';
import { jest } from '@jest/globals';

export function createMockTokenService(): jest.Mocked<ITokenService> {
  return {
    generateToken: jest.fn(),
    verifyToken: jest.fn(),
  };
}
