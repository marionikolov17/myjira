import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { WorkspaceService } from '@/modules/workspace/workspace.service';
import { IUserRepository } from '@/modules/users';
import { IWorkspaceRoleRepository, WorkspaceRoleName } from '@/modules/workspace-roles';
import { IWorkspaceUsersConfig } from '@/config/workspace-users/workspace-users-config';
import { env } from '@/config/env';
import {
  createMockUserRepository,
  createMockWorkspaceRoleRepository,
  createMockWorkspaceUsersConfig,
  mockUsersAfterBulkCreate,
  mockWorkspaceRoles,
  mockUsersConfig,
  createMockBootstrapWorkspaceConfig,
} from './workspace.service.mock';
import { AuthorizationError, ResourceNotFoundError } from '@/common/errors';
import { mockLogger } from '../../mocks/logger.mock';

describe('WorkspaceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('bootstrapWorkspaceUsers', () => {
    let mockUserRepository: ReturnType<typeof createMockUserRepository>;
    let mockWorkspaceRoleRepository: ReturnType<typeof createMockWorkspaceRoleRepository>;
    let mockWorkspaceUsersConfig: ReturnType<typeof createMockWorkspaceUsersConfig>;
    let mockBootstrapWorkspaceConfig: ReturnType<typeof createMockBootstrapWorkspaceConfig>;
    let workspaceService: WorkspaceService;

    beforeEach(() => {
      mockUserRepository = createMockUserRepository(mockUsersAfterBulkCreate);
      mockWorkspaceRoleRepository = createMockWorkspaceRoleRepository(mockWorkspaceRoles);
      mockWorkspaceUsersConfig = createMockWorkspaceUsersConfig(mockUsersConfig);
      mockBootstrapWorkspaceConfig = createMockBootstrapWorkspaceConfig(env.BOOTSTRAP_TOKEN);
      workspaceService = new WorkspaceService(
        mockUserRepository as unknown as IUserRepository,
        mockWorkspaceRoleRepository as unknown as IWorkspaceRoleRepository,
        mockWorkspaceUsersConfig as unknown as IWorkspaceUsersConfig,
        mockLogger,
        mockBootstrapWorkspaceConfig,
      );
    });

    it('should bootstrap workspace users', async () => {
      const result = await workspaceService.bootstrapWorkspaceUsers({
        bootstrapToken: env.BOOTSTRAP_TOKEN,
      });

      expect(result).toEqual(mockUsersAfterBulkCreate);
    });

    it('should call the user repository bulk create users method with correct users config', async () => {
      await workspaceService.bootstrapWorkspaceUsers({ bootstrapToken: env.BOOTSTRAP_TOKEN });
      expect(mockUserRepository.bulkCreateUsers).toHaveBeenCalledWith({ users: mockUsersConfig });
    });

    it('should throw an unauthorized error when bootstrap token is invalid', async () => {
      await expect(
        workspaceService.bootstrapWorkspaceUsers({ bootstrapToken: 'invalid-token' }),
      ).rejects.toThrow(AuthorizationError);
    });

    it('should propagate an error when get workspace roles fails', async () => {
      mockWorkspaceRoleRepository.getWorkspaceRoles.mockRejectedValue(
        new Error('Failed to get workspace roles') as never,
      );

      await expect(
        workspaceService.bootstrapWorkspaceUsers({ bootstrapToken: env.BOOTSTRAP_TOKEN }),
      ).rejects.toThrow(Error);
    });

    it('should throw a resource not found error when workspace roles are not found', async () => {
      mockWorkspaceRoleRepository.getWorkspaceRoles.mockResolvedValue([] as never);

      await expect(
        workspaceService.bootstrapWorkspaceUsers({ bootstrapToken: env.BOOTSTRAP_TOKEN }),
      ).rejects.toThrow(ResourceNotFoundError);
    });

    it('should throw a resource not found error when workspace role is not found', async () => {
      mockWorkspaceRoleRepository.getWorkspaceRoles.mockResolvedValue([
        { id: '1', name: WorkspaceRoleName.ADMIN },
      ] as never);

      await expect(
        workspaceService.bootstrapWorkspaceUsers({ bootstrapToken: env.BOOTSTRAP_TOKEN }),
      ).rejects.toThrow(ResourceNotFoundError);
    });

    it('should propagate an error when bulk create users fails', async () => {
      mockUserRepository.bulkCreateUsers.mockRejectedValue(
        new Error('Failed to bulk create users') as never,
      );

      await expect(
        workspaceService.bootstrapWorkspaceUsers({ bootstrapToken: env.BOOTSTRAP_TOKEN }),
      ).rejects.toThrow(Error);
    });
  });
});
