import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ILogger } from '@/common/logger/logger.interface';
import { ITokenService } from '@/common/token-service/token-service.interface';
import { IPasswordHasher } from '@/common/password-hasher/password-hasher.interface';
import { InvalidLoginCredentialsError } from '@/common/errors';

import { IAuthService } from '@/modules/auth/auth.interface';
import { AuthService } from '@/modules/auth/auth.service';
import { IUserRepository } from '@/modules/users';

import { createMockLogger } from '../../mocks/logger.mock';
import { createMockTokenService } from '../../mocks/token-service.mock';
import { createMockUserRepository } from '../../mocks/user.repository.mock';
import { createMockPasswordHasher } from '../../mocks/password-hasher.mock';

import {
  GENERATED_TOKEN,
  VALID_EMAIL,
  VALID_PASSWORD,
  WRONG_EMAIL,
  WRONG_PASSWORD,
  mockUserWithPassword,
} from './auth.service.mock';

describe('AuthService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('login', () => {
    let mockUserRepository: jest.Mocked<IUserRepository>;
    let mockTokenService: jest.Mocked<ITokenService>;
    let mockPasswordHasher: jest.Mocked<IPasswordHasher>;
    let mockLogger: jest.Mocked<ILogger>;

    let authService: IAuthService;

    beforeEach(() => {
      mockUserRepository = createMockUserRepository();
      mockUserRepository.getUserByEmailWithPassword.mockResolvedValue(mockUserWithPassword);

      mockTokenService = createMockTokenService();
      mockTokenService.generateToken.mockReturnValue(GENERATED_TOKEN);

      mockPasswordHasher = createMockPasswordHasher();
      mockPasswordHasher.verifyPassword.mockResolvedValue(true);

      mockLogger = createMockLogger();

      authService = new AuthService(
        mockUserRepository,
        mockTokenService,
        mockPasswordHasher,
        mockLogger,
      );
    });

    it('should return a token when credentials are valid', async () => {
      const token = await authService.login({ email: VALID_EMAIL, password: VALID_PASSWORD });
      expect(token).toBe(GENERATED_TOKEN);
    });

    it('should generate a token with the user id and workspace role id', async () => {
      await authService.login({ email: VALID_EMAIL, password: VALID_PASSWORD });

      expect(mockTokenService.generateToken).toHaveBeenCalledWith({
        userId: mockUserWithPassword.id,
        workspaceRoleId: mockUserWithPassword.workspaceRoleId,
      });
    });

    it('should throw an invalid login credentials error when user does not exist', async () => {
      mockUserRepository.getUserByEmailWithPassword.mockResolvedValue(null);

      await expect(
        authService.login({ email: WRONG_EMAIL, password: VALID_PASSWORD }),
      ).rejects.toThrow(InvalidLoginCredentialsError);
    });

    it('should log an error when user does not exist', async () => {
      mockUserRepository.getUserByEmailWithPassword.mockResolvedValue(null);

      await expect(
        authService.login({ email: WRONG_EMAIL, password: VALID_PASSWORD }),
      ).rejects.toThrow(InvalidLoginCredentialsError);

      expect(mockLogger.error).toHaveBeenCalledWith('Invalid login credentials', {
        email: WRONG_EMAIL,
      });
    });

    it('should not generate a token when user does not exist', async () => {
      mockUserRepository.getUserByEmailWithPassword.mockResolvedValue(null);

      await expect(
        authService.login({ email: WRONG_EMAIL, password: VALID_PASSWORD }),
      ).rejects.toThrow(InvalidLoginCredentialsError);

      expect(mockTokenService.generateToken).not.toHaveBeenCalled();
    });

    it('should throw an invalid login credentials error when the password is incorrect', async () => {
      mockPasswordHasher.verifyPassword.mockResolvedValue(false);

      await expect(
        authService.login({ email: VALID_EMAIL, password: WRONG_PASSWORD }),
      ).rejects.toThrow(InvalidLoginCredentialsError);
    });

    it('should log an error when the password is incorrect', async () => {
      mockPasswordHasher.verifyPassword.mockResolvedValue(false);

      await expect(
        authService.login({ email: VALID_EMAIL, password: WRONG_PASSWORD }),
      ).rejects.toThrow(InvalidLoginCredentialsError);

      expect(mockLogger.error).toHaveBeenCalledWith('Invalid login credentials', {
        email: VALID_EMAIL,
      });
    });

    it('should not generate a token when the password is incorrect', async () => {
      mockPasswordHasher.verifyPassword.mockResolvedValue(false);

      await expect(
        authService.login({ email: VALID_EMAIL, password: WRONG_PASSWORD }),
      ).rejects.toThrow(InvalidLoginCredentialsError);

      expect(mockTokenService.generateToken).not.toHaveBeenCalled();
    });

    it('should propagate the error when getUserByEmailWithPassword fails', async () => {
      mockUserRepository.getUserByEmailWithPassword.mockRejectedValue(new Error('Database error'));

      await expect(
        authService.login({ email: VALID_EMAIL, password: VALID_PASSWORD }),
      ).rejects.toThrow('Database error');
    });

    it('should propagate the error when verifyPassword fails', async () => {
      mockPasswordHasher.verifyPassword.mockRejectedValue(new Error('Password verification error'));

      await expect(
        authService.login({ email: VALID_EMAIL, password: VALID_PASSWORD }),
      ).rejects.toThrow('Password verification error');
    });

    it('should propagate the error when generateToken fails', async () => {
      mockTokenService.generateToken.mockImplementation(() => {
        throw new Error('Token generation error');
      });

      await expect(
        authService.login({ email: VALID_EMAIL, password: VALID_PASSWORD }),
      ).rejects.toThrow('Token generation error');
    });
  });
});
