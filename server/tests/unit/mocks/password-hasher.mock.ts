import { jest } from '@jest/globals';
import { IPasswordHasher } from '@/common/password-hasher/password-hasher.interface';

export function createMockPasswordHasher(): jest.Mocked<IPasswordHasher> {
  return {
    hashPassword: jest.fn(),
    verifyPassword: jest.fn(),
  };
}
