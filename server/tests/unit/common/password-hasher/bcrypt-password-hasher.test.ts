import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import bcrypt from 'bcrypt';
import { BcryptPasswordHasher } from '@/common/password-hasher/bcrypt-password-hasher';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));
const mockBcrypt = jest.mocked(bcrypt);

const saltRounds = 10;

describe('BcryptPasswordHasher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should hash a password', async () => {
    const password = 'password';
    const mockHashedPassword = 'hashedPassword';

    mockBcrypt.hash.mockResolvedValue(mockHashedPassword as never);
    const bcryptPasswordHasher = new BcryptPasswordHasher(saltRounds);

    const hashedPassword = await bcryptPasswordHasher.hashPassword(password);

    expect(hashedPassword).toBe(mockHashedPassword);
    expect(mockBcrypt.hash).toHaveBeenCalledWith(password, saltRounds);
  });

  it('should verify correct password', async () => {
    const password = 'password';
    const hashedPassword = 'hashedPassword';

    mockBcrypt.compare.mockResolvedValue(true as never);
    const bcryptPasswordHasher = new BcryptPasswordHasher(saltRounds);

    const isCorrect = await bcryptPasswordHasher.verifyPassword(password, hashedPassword);

    expect(isCorrect).toBe(true);
    expect(mockBcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
  });

  it('should verify incorrect password', async () => {
    const password = 'password';
    const hashedPassword = 'hashedPassword';

    mockBcrypt.compare.mockResolvedValue(false as never);
    const bcryptPasswordHasher = new BcryptPasswordHasher(saltRounds);

    const isCorrect = await bcryptPasswordHasher.verifyPassword(password, hashedPassword);

    expect(isCorrect).toBe(false);
    expect(mockBcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
  });
});
