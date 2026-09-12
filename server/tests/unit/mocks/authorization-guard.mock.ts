import { jest } from '@jest/globals';
import { IAuthorizationGuard } from '@/common/authorization';

export function createMockAuthorizationGuard(): jest.Mocked<IAuthorizationGuard> {
  return {
    authorize: jest.fn(),
  };
}
