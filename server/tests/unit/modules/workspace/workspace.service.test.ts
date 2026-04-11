import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { WorkspaceService } from '@/modules/workspace/workspace.service';
import { IUserRepository } from '@/modules/users';
import { IWorkspaceRoleRepository, WorkspaceRoleName } from '@/modules/workspace-roles';
import { AuthorizationError, ResourceNotFoundError } from '@/common/errors';
import { IWorkspaceService } from '@/modules/workspace/workspace.interface';
import {
  BootstrapWorkspaceConfigParams,
  BootstrapWorkspaceUsersParams,
} from '@/modules/workspace/workspace.types';
import { IWorkspaceUsersConfig } from '@/config/workspace-users/workspace-users-config';
import { ILogger } from '@/common/logger';
import {
  createMockWorkspaceUsersConfig,
  mockUsersAfterBulkCreate,
  mockWorkspaceRoles,
  mockUsersConfig,
  createMockBootstrapWorkspaceConfig,
} from './workspace.service.mock';
import { createMockLogger } from '../../mocks/logger.mock';
import { createMockUserRepository } from '../../mocks/user.repository.mock';
import { createMockWorkspaceRoleRepository } from '../../mocks/workspace-role.repository.mock';

describe('WorkspaceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('bootstrapWorkspaceUsers', () => {
    let mockUserRepository: jest.Mocked<IUserRepository>;
    let mockWorkspaceRoleRepository: jest.Mocked<IWorkspaceRoleRepository>;

    let mockWorkspaceUsersConfig: jest.Mocked<IWorkspaceUsersConfig>;
    let mockBootstrapWorkspaceConfig: jest.Mocked<BootstrapWorkspaceConfigParams>;
    let mockBootstrapWorkspaceUsersParams: jest.Mocked<BootstrapWorkspaceUsersParams>;

    let mockLogger: jest.Mocked<ILogger>;

    let workspaceService: IWorkspaceService;

    beforeEach(() => {
      mockUserRepository = createMockUserRepository();
      mockUserRepository.bulkCreateUsers.mockResolvedValue(mockUsersAfterBulkCreate);

      mockWorkspaceRoleRepository = createMockWorkspaceRoleRepository();
      mockWorkspaceRoleRepository.getWorkspaceRoles.mockResolvedValue(mockWorkspaceRoles);

      mockWorkspaceUsersConfig = createMockWorkspaceUsersConfig();
      mockWorkspaceUsersConfig.getUsers.mockResolvedValue(mockUsersConfig);

      mockBootstrapWorkspaceConfig = createMockBootstrapWorkspaceConfig();
      mockBootstrapWorkspaceUsersParams = {
        bootstrapToken: mockBootstrapWorkspaceConfig.bootstrapToken,
      };

      mockLogger = createMockLogger();

      workspaceService = new WorkspaceService(
        mockUserRepository,
        mockWorkspaceRoleRepository,
        mockWorkspaceUsersConfig,
        mockLogger,
        mockBootstrapWorkspaceConfig,
      );
    });

    it('should bootstrap workspace users', async () => {
      const result = await workspaceService.bootstrapWorkspaceUsers(
        mockBootstrapWorkspaceUsersParams,
      );

      expect(result).toEqual(mockUsersAfterBulkCreate);
    });

    it('should call the user repository bulk create users method with correct users config', async () => {
      await workspaceService.bootstrapWorkspaceUsers(mockBootstrapWorkspaceUsersParams);
      expect(mockUserRepository.bulkCreateUsers).toHaveBeenCalledWith({
        users: mockUsersConfig,
      });
    });

    it('should throw an unauthorized error when bootstrap token is invalid', async () => {
      mockBootstrapWorkspaceUsersParams.bootstrapToken = 'invalid-token';

      await expect(
        workspaceService.bootstrapWorkspaceUsers(mockBootstrapWorkspaceUsersParams),
      ).rejects.toThrow(AuthorizationError);
    });

    it('should propagate an error when get workspace roles fails', async () => {
      mockWorkspaceRoleRepository.getWorkspaceRoles.mockRejectedValue(
        new Error('Failed to get workspace roles'),
      );

      await expect(
        workspaceService.bootstrapWorkspaceUsers(mockBootstrapWorkspaceUsersParams),
      ).rejects.toThrow(Error);
    });

    it('should throw a resource not found error when no workspace roles are found', async () => {
      mockWorkspaceRoleRepository.getWorkspaceRoles.mockResolvedValue([]);

      await expect(
        workspaceService.bootstrapWorkspaceUsers(mockBootstrapWorkspaceUsersParams),
      ).rejects.toThrow(ResourceNotFoundError);
    });

    it('should throw a resource not found error when not all workspace roles are found', async () => {
      mockWorkspaceRoleRepository.getWorkspaceRoles.mockResolvedValue([
        { id: '1', name: WorkspaceRoleName.ADMIN, createdAt: new Date(), updatedAt: new Date() },
        {
          id: '2',
          name: WorkspaceRoleName.DEVELOPER,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      await expect(
        workspaceService.bootstrapWorkspaceUsers(mockBootstrapWorkspaceUsersParams),
      ).rejects.toThrow(ResourceNotFoundError);
    });

    it('should propagate an error when bulk create users fails', async () => {
      mockUserRepository.bulkCreateUsers.mockRejectedValue(
        new Error('Failed to bulk create users'),
      );

      await expect(
        workspaceService.bootstrapWorkspaceUsers(mockBootstrapWorkspaceUsersParams),
      ).rejects.toThrow(Error);
    });
  });
});
