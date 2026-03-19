import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPasswordHasherInstance = { mock: true };
jest.mock('@/common/password-hasher/create-password-hasher', () => ({
  createPasswordHasher: jest.fn().mockReturnValue(mockPasswordHasherInstance),
}));

function mockEnv(saltRounds: number) {
  jest.doMock('@/config/env', () => ({
    env: { SALT_ROUNDS: saltRounds },
  }));
}

describe('passwordHasher', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('should create a password hasher with the correct config', async () => {
    const saltRounds = 10;
    mockEnv(saltRounds);

    const { passwordHasher } = await import('@/common/password-hasher/password-hasher');
    const { createPasswordHasher } =
      await import('@/common/password-hasher/create-password-hasher');

    expect(passwordHasher).toBe(mockPasswordHasherInstance);
    expect(createPasswordHasher).toHaveBeenCalledWith({ saltRounds });
  });
});
