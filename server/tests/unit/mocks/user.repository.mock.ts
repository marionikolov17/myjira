import { jest } from '@jest/globals';
import { IUserRepository } from '@/modules/users';

export function createMockUserRepository(): jest.Mocked<IUserRepository> {
  return {
    resourceName: 'users',
    createUser: jest.fn(),
    bulkCreateUsers: jest.fn(),
  };
}
