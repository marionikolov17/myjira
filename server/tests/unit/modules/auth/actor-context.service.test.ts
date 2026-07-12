import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { AuthenticationError } from '@/common/errors';
import { ILogger } from '@/common/logger/logger.interface';

import { IActorContextService } from '@/modules/auth/actor-context.interface';
import { ActorContextService } from '@/modules/auth/actor-context.service';
import { IUserRepository } from '@/modules/users';
import { IWorkspaceRoleRepository } from '@/modules/workspace-roles';
import { IProjectMemberRepository } from '@/modules/project-members';

import { createMockLogger } from '../../mocks/logger.mock';
import { createMockUserRepository } from '../../mocks/user.repository.mock';
import { createMockWorkspaceRoleRepository } from '../../mocks/workspace-role.repository.mock';
import { createMockProjectMemberRepository } from '../../mocks/project-member.repository.mock';

import {
  mockProjectMembers,
  mockTokenPayload,
  mockUser,
  mockWorkspaceRole,
} from './actor-context.service.mock';

describe('ActorContextService', () => {
  let mockUserRepository: jest.Mocked<IUserRepository>;
  let mockWorkspaceRoleRepository: jest.Mocked<IWorkspaceRoleRepository>;
  let mockProjectMemberRepository: jest.Mocked<IProjectMemberRepository>;
  let mockLogger: jest.Mocked<ILogger>;

  let actorContextService: IActorContextService;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();

    mockUserRepository = createMockUserRepository();
    mockUserRepository.getUserById.mockResolvedValue(mockUser);

    mockWorkspaceRoleRepository = createMockWorkspaceRoleRepository();
    mockWorkspaceRoleRepository.getWorkspaceRoleById.mockResolvedValue(mockWorkspaceRole);

    mockProjectMemberRepository = createMockProjectMemberRepository();
    mockProjectMemberRepository.getProjectMembersByUserId.mockResolvedValue(mockProjectMembers);

    mockLogger = createMockLogger();

    actorContextService = new ActorContextService(
      mockUserRepository,
      mockWorkspaceRoleRepository,
      mockProjectMemberRepository,
      mockLogger,
    );
  });

  describe('buildActorContext', () => {
    it('should build an actor context with the resolved user id', async () => {
      const actor = await actorContextService.buildActorContext(mockTokenPayload);

      expect(actor.userId).toBe(mockUser.id);
    });

    it('should look up the user by the token user id', async () => {
      await actorContextService.buildActorContext(mockTokenPayload);

      expect(mockUserRepository.getUserById).toHaveBeenCalledWith(mockTokenPayload.userId);
    });

    it('should look up the workspace role by the token workspace role id', async () => {
      await actorContextService.buildActorContext(mockTokenPayload);

      expect(mockWorkspaceRoleRepository.getWorkspaceRoleById).toHaveBeenCalledWith(
        mockTokenPayload.workspaceRoleId,
      );
    });

    it('should resolve the workspace role id and name', async () => {
      const actor = await actorContextService.buildActorContext(mockTokenPayload);

      expect(actor.workspaceRole).toEqual({
        id: mockWorkspaceRole.id,
        name: mockWorkspaceRole.name,
      });
    });

    it('should map every project membership to a project role entry', async () => {
      const actor = await actorContextService.buildActorContext(mockTokenPayload);

      expect(actor.projectRoles).toEqual(
        mockProjectMembers.map((member) => ({
          projectId: member.projectId,
          projectRoleId: member.projectRole.id,
          projectRoleName: member.projectRole.name,
        })),
      );
    });

    it('should look up project members by the resolved user id', async () => {
      await actorContextService.buildActorContext(mockTokenPayload);

      expect(mockProjectMemberRepository.getProjectMembersByUserId).toHaveBeenCalledWith(
        mockUser.id,
      );
    });

    it('should return an empty projectRoles array when the user has no memberships', async () => {
      mockProjectMemberRepository.getProjectMembersByUserId.mockResolvedValue([]);

      const actor = await actorContextService.buildActorContext(mockTokenPayload);

      expect(actor.projectRoles).toEqual([]);
    });

    it('should throw an authentication error when the user no longer exists', async () => {
      mockUserRepository.getUserById.mockResolvedValue(null);

      await expect(actorContextService.buildActorContext(mockTokenPayload)).rejects.toThrow(
        AuthenticationError,
      );
    });

    it('should log an error when the user no longer exists', async () => {
      mockUserRepository.getUserById.mockResolvedValue(null);

      await expect(actorContextService.buildActorContext(mockTokenPayload)).rejects.toThrow(
        AuthenticationError,
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Cannot build actor context: user no longer exists',
        { userId: mockTokenPayload.userId },
      );
    });

    it('should not resolve the workspace role when the user no longer exists', async () => {
      mockUserRepository.getUserById.mockResolvedValue(null);

      await expect(actorContextService.buildActorContext(mockTokenPayload)).rejects.toThrow(
        AuthenticationError,
      );

      expect(mockWorkspaceRoleRepository.getWorkspaceRoleById).not.toHaveBeenCalled();
    });

    it('should not resolve project members when the user no longer exists', async () => {
      mockUserRepository.getUserById.mockResolvedValue(null);

      await expect(actorContextService.buildActorContext(mockTokenPayload)).rejects.toThrow(
        AuthenticationError,
      );

      expect(mockProjectMemberRepository.getProjectMembersByUserId).not.toHaveBeenCalled();
    });

    it('should throw an authentication error when the workspace role is not found', async () => {
      mockWorkspaceRoleRepository.getWorkspaceRoleById.mockResolvedValue(null);

      await expect(actorContextService.buildActorContext(mockTokenPayload)).rejects.toThrow(
        AuthenticationError,
      );
    });

    it('should log an error when the workspace role is not found', async () => {
      mockWorkspaceRoleRepository.getWorkspaceRoleById.mockResolvedValue(null);

      await expect(actorContextService.buildActorContext(mockTokenPayload)).rejects.toThrow(
        AuthenticationError,
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Cannot build actor context: workspace role not found',
        {
          userId: mockTokenPayload.userId,
          workspaceRoleId: mockTokenPayload.workspaceRoleId,
        },
      );
    });

    it('should not resolve project members when the workspace role is not found', async () => {
      mockWorkspaceRoleRepository.getWorkspaceRoleById.mockResolvedValue(null);

      await expect(actorContextService.buildActorContext(mockTokenPayload)).rejects.toThrow(
        AuthenticationError,
      );

      expect(mockProjectMemberRepository.getProjectMembersByUserId).not.toHaveBeenCalled();
    });

    it('should propagate the error when the user repository fails', async () => {
      mockUserRepository.getUserById.mockRejectedValue(new Error('database unavailable'));

      await expect(actorContextService.buildActorContext(mockTokenPayload)).rejects.toThrow(
        'database unavailable',
      );
    });

    it('should propagate the error when the workspace role repository fails', async () => {
      mockWorkspaceRoleRepository.getWorkspaceRoleById.mockRejectedValue(
        new Error('database unavailable'),
      );

      await expect(actorContextService.buildActorContext(mockTokenPayload)).rejects.toThrow(
        'database unavailable',
      );
    });

    it('should propagate the error when the project member repository fails', async () => {
      mockProjectMemberRepository.getProjectMembersByUserId.mockRejectedValue(
        new Error('database unavailable'),
      );

      await expect(actorContextService.buildActorContext(mockTokenPayload)).rejects.toThrow(
        'database unavailable',
      );
    });
  });
});
