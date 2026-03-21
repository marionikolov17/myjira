import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SystemService } from '@/modules/system/system.service';
import { IUserRepository } from '@/modules/users';
import { IWorkspaceRoleRepository } from '@/modules/workspace-roles';
import { IPasswordHasher } from '@/common/password-hasher';
import { env } from '@/config/env';
import {
  createMockUserRepository,
  createMockWorkspaceRoleRepository,
  createMockPasswordHasher,
  mockUsersAfterBulkUpsert,
  mockWorkspaceRoles,
  mockHashedPassword,
  mockUsersConfig,
} from './system.service.mock';
import { AuthorizationError, ResourceNotFoundError } from '@/common/errors';

describe('SystemService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('bootstrapSystemUsers', () => {
    let mockUserRepository: ReturnType<typeof createMockUserRepository>;
    let mockWorkspaceRoleRepository: ReturnType<typeof createMockWorkspaceRoleRepository>;
    let mockPasswordHasher: ReturnType<typeof createMockPasswordHasher>;
    let systemService: SystemService;

    beforeEach(() => {
      mockUserRepository = createMockUserRepository(mockUsersAfterBulkUpsert);
      mockWorkspaceRoleRepository = createMockWorkspaceRoleRepository(mockWorkspaceRoles);
      mockPasswordHasher = createMockPasswordHasher(mockHashedPassword);
      systemService = new SystemService(
        mockUserRepository as unknown as IUserRepository,
        mockWorkspaceRoleRepository as unknown as IWorkspaceRoleRepository,
        mockPasswordHasher as unknown as IPasswordHasher,
      );
    });

    it('should bootstrap system users', async () => {
      const result = await systemService.bootstrapSystemUsers({
        bootstrapToken: env.BOOTSTRAP_TOKEN,
      });

      expect(result).toEqual(mockUsersAfterBulkUpsert);
    });

    it('should call the user repository bulk upsert users method with correct users config', async () => {
      await systemService.bootstrapSystemUsers({ bootstrapToken: env.BOOTSTRAP_TOKEN });
      expect(mockUserRepository.bulkUpsertUsers).toHaveBeenCalledWith({ users: mockUsersConfig });
    });

    it('should throw an unauthorized error when bootstrap token is invalid', async () => {
      await expect(
        systemService.bootstrapSystemUsers({ bootstrapToken: 'invalid-token' }),
      ).rejects.toThrow(AuthorizationError);
    });

    it('should propagate an error when get workspace roles fails', async () => {
      mockWorkspaceRoleRepository.getWorkspaceRoles.mockRejectedValue(
        new Error('Failed to get workspace roles') as never,
      );

      const error = await systemService
        .bootstrapSystemUsers({ bootstrapToken: env.BOOTSTRAP_TOKEN })
        .catch((e) => e);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Failed to get workspace roles');
    });

    it('should throw a resource not found error when workspace roles are not found', async () => {
      mockWorkspaceRoleRepository.getWorkspaceRoles.mockResolvedValue([] as never);

      const error = await systemService
        .bootstrapSystemUsers({ bootstrapToken: env.BOOTSTRAP_TOKEN })
        .catch((e) => e);
      expect(error).toBeInstanceOf(ResourceNotFoundError);
      expect(error.details?.resource).toEqual({
        resourceName: mockWorkspaceRoleRepository.resourceName,
      });
    });

    it('should propagate an error when password hashing fails', async () => {
      mockPasswordHasher.hashPassword.mockRejectedValue(
        new Error('Failed to hash password') as never,
      );

      const error = await systemService
        .bootstrapSystemUsers({ bootstrapToken: env.BOOTSTRAP_TOKEN })
        .catch((e) => e);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Failed to hash password');
    });

    it('should propagate an error when bulk upsert users fails', async () => {
      mockUserRepository.bulkUpsertUsers.mockRejectedValue(
        new Error('Failed to bulk upsert users') as never,
      );

      const error = await systemService
        .bootstrapSystemUsers({ bootstrapToken: env.BOOTSTRAP_TOKEN })
        .catch((e) => e);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Failed to bulk upsert users');
    });
  });
});
