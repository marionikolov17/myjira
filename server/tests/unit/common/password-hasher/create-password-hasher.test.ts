import { describe, expect, it } from '@jest/globals';
import { BcryptPasswordHasher } from '@/common/password-hasher/bcrypt-password-hasher';
import { createPasswordHasher } from '@/common/password-hasher/create-password-hasher';

const config = {
  saltRounds: 10,
};

describe('createPasswordHasher', () => {
  it('should create a bcrypt password hasher', () => {
    const passwordHasher = createPasswordHasher(config);

    expect(passwordHasher).toBeInstanceOf(BcryptPasswordHasher);
    expect(passwordHasher.hashPassword).toBeDefined();
    expect(passwordHasher.verifyPassword).toBeDefined();
  });
});
