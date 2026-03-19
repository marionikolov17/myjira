import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import bcrypt from 'bcrypt';
import { BcryptPasswordHasher } from '@/common/password-hasher/bcrypt-password-hasher';
import { mockHashedPassword, mockPassword, mockSaltRounds } from './bcrypt-password-hasher.mock';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));
const mockBcrypt = jest.mocked(bcrypt);

describe('BcryptPasswordHasher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should hash a password', async () => {
    mockBcrypt.hash.mockResolvedValue(mockHashedPassword as never);
    const bcryptPasswordHasher = new BcryptPasswordHasher(mockSaltRounds);

    const hashedPassword = await bcryptPasswordHasher.hashPassword(mockPassword);

    expect(hashedPassword).toBe(mockHashedPassword);
    expect(mockBcrypt.hash).toHaveBeenCalledWith(mockPassword, mockSaltRounds);
  });

  it('should call bcrypt.hash with the correct parameters', async () => {
    mockBcrypt.hash.mockResolvedValue(mockHashedPassword as never);
    const bcryptPasswordHasher = new BcryptPasswordHasher(mockSaltRounds);

    await bcryptPasswordHasher.hashPassword(mockPassword);

    expect(mockBcrypt.hash).toHaveBeenCalledWith(mockPassword, mockSaltRounds);
  });

  it('should verify correct password', async () => {
    mockBcrypt.compare.mockResolvedValue(true as never);
    const bcryptPasswordHasher = new BcryptPasswordHasher(mockSaltRounds);

    const isCorrect = await bcryptPasswordHasher.verifyPassword(mockPassword, mockHashedPassword);

    expect(isCorrect).toBe(true);
  });

  it('should verify incorrect password', async () => {
    mockBcrypt.compare.mockResolvedValue(false as never);
    const bcryptPasswordHasher = new BcryptPasswordHasher(mockSaltRounds);

    const isCorrect = await bcryptPasswordHasher.verifyPassword(mockPassword, mockHashedPassword);

    expect(isCorrect).toBe(false);
  });

  it('should call bcrypt.compare with the correct parameters', async () => {
    mockBcrypt.compare.mockResolvedValue(true as never);
    const bcryptPasswordHasher = new BcryptPasswordHasher(mockSaltRounds);

    await bcryptPasswordHasher.verifyPassword(mockPassword, mockHashedPassword);

    expect(mockBcrypt.compare).toHaveBeenCalledWith(mockPassword, mockHashedPassword);
  });
});
