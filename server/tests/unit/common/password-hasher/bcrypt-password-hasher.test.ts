import { describe, expect, it } from '@jest/globals';
import { BcryptPasswordHasher } from '@/common/password-hasher/bcrypt-password-hasher';

const config = {
  saltRounds: 10,
};

describe('BcryptPasswordHasher.create', () => {
  it('should create a bcrypt password hasher', () => {
    const passwordHasher = BcryptPasswordHasher.create(config);

    expect(passwordHasher).toBeInstanceOf(BcryptPasswordHasher);
  });
});
