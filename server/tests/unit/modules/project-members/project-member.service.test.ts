import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ILogger } from '@/common/logger';
import { IAuthorizationGuard, AuthorizationScope } from '@/common/authorization';
import {
  AuthorizationError,
  BusinessRuleViolationError,
  ResourceNotFoundError,
} from '@/common/errors';

import { IProjectRepository } from '@/modules/projects/project.interface';
import { IProjectRoleRepository } from '@/modules/project-roles';
import { IProjectMemberRepository, IProjectMemberService } from '@/modules/project-members';
import { ProjectMemberService } from '@/modules/project-members/project-member.service';

import { createMockLogger } from '../../mocks/logger.mock';
import { createMockAuthorizationGuard } from '../../mocks/authorization-guard.mock';
import { createMockProjectMemberRepository } from '../../mocks/project-member.repository.mock';
import { createMockProjectRoleRepository } from '../../mocks/project-role.repository.mock';
import { createMockProjectRepository } from '../../mocks/project.repository.mock';

import {
  DEVELOPER_MEMBER_ID,
  OTHER_PROJECT_ID,
  PROJECT_ADMIN_MEMBER_ID,
  PROJECT_ID,
  PROJECT_OWNER_MEMBER_ID,
  addDeveloperInput,
  addProjectAdminInput,
  addProjectOwnerInput,
  addUnknownRoleInput,
  createdDeveloperMember,
  createdProjectAdminMember,
  developerMember,
  developerProjectRole,
  project,
  projectAdminActor,
  projectAdminMember,
  projectAdminRole,
  projectDeveloperActor,
  projectOwnerActor,
  projectOwnerMember,
  projectOwnerRole,
  selfDeveloperMember,
  updateToProjectAdminInput,
  updateToProjectOwnerInput,
  updateToUnknownRoleInput,
  updatedToProjectAdminMember,
  workspaceAdminActor,
  workspaceDeveloperActor,
  workspaceOwnerActor,
} from './project-member.service.mock';

describe('ProjectMemberService', () => {
  let mockProjectMemberRepository: jest.Mocked<IProjectMemberRepository>;
  let mockProjectRoleRepository: jest.Mocked<IProjectRoleRepository>;
  let mockProjectRepository: jest.Mocked<IProjectRepository>;
  let mockAuthorizationGuard: jest.Mocked<IAuthorizationGuard>;
  let mockLogger: jest.Mocked<ILogger>;

  let projectMemberService: IProjectMemberService;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();

    mockProjectMemberRepository = createMockProjectMemberRepository();
    mockProjectRoleRepository = createMockProjectRoleRepository();
    mockProjectRepository = createMockProjectRepository();
    mockAuthorizationGuard = createMockAuthorizationGuard();
    mockLogger = createMockLogger();

    mockProjectRepository.getProjectById.mockResolvedValue(project);

    mockProjectRoleRepository.getProjectRoleById.mockImplementation(async (id) => {
      if (id === projectOwnerRole.id) return projectOwnerRole;
      if (id === projectAdminRole.id) return projectAdminRole;
      if (id === developerProjectRole.id) return developerProjectRole;
      return null;
    });

    projectMemberService = new ProjectMemberService(
      mockProjectMemberRepository,
      mockProjectRoleRepository,
      mockProjectRepository,
      mockAuthorizationGuard,
      mockLogger,
    );
  });

  describe('addProjectMember', () => {
    beforeEach(() => {
      mockProjectMemberRepository.createProjectMember.mockResolvedValue(createdDeveloperMember);
    });

    it('should authorize the actor on the project addProjectMember action with the resource', async () => {
      await projectMemberService.addProjectMember(
        workspaceOwnerActor,
        PROJECT_ID,
        addDeveloperInput,
      );

      expect(mockAuthorizationGuard.authorize).toHaveBeenCalledWith({
        actor: workspaceOwnerActor,
        scope: AuthorizationScope.Project,
        action: 'addProjectMember',
        resource: PROJECT_ID,
      });
    });

    it.each([
      { case: 'Workspace Owner (bypass)', getActor: () => workspaceOwnerActor },
      { case: 'Project Owner member', getActor: () => projectOwnerActor },
    ])('should allow a $case to add a Project Admin target', async ({ getActor }) => {
      mockProjectMemberRepository.createProjectMember.mockResolvedValue(createdProjectAdminMember);

      const result = await projectMemberService.addProjectMember(
        getActor(),
        PROJECT_ID,
        addProjectAdminInput,
      );

      expect(result).toEqual(createdProjectAdminMember);
      expect(mockProjectMemberRepository.createProjectMember).toHaveBeenCalledWith({
        projectId: PROJECT_ID,
        userId: addProjectAdminInput.userId,
        projectRoleId: addProjectAdminInput.projectRoleId,
      });
    });

    it('should allow a Project Admin to add a Developer target', async () => {
      const result = await projectMemberService.addProjectMember(
        projectAdminActor,
        PROJECT_ID,
        addDeveloperInput,
      );

      expect(result).toEqual(createdDeveloperMember);
      expect(mockProjectMemberRepository.createProjectMember).toHaveBeenCalledWith({
        projectId: PROJECT_ID,
        userId: addDeveloperInput.userId,
        projectRoleId: addDeveloperInput.projectRoleId,
      });
    });

    it('should throw an authorization error and perform no reads or writes when the guard rejects the actor', async () => {
      mockAuthorizationGuard.authorize.mockImplementation(() => {
        throw new AuthorizationError();
      });

      await expect(
        projectMemberService.addProjectMember(workspaceAdminActor, PROJECT_ID, addDeveloperInput),
      ).rejects.toThrow(AuthorizationError);

      expect(mockProjectRepository.getProjectById).not.toHaveBeenCalled();
      expect(mockProjectRoleRepository.getProjectRoleById).not.toHaveBeenCalled();
      expect(mockProjectMemberRepository.createProjectMember).not.toHaveBeenCalled();
    });

    it('should throw a resource not found error and not persist when the target project does not exist', async () => {
      mockProjectRepository.getProjectById.mockResolvedValue(null);

      await expect(
        projectMemberService.addProjectMember(workspaceOwnerActor, PROJECT_ID, addDeveloperInput),
      ).rejects.toThrow(ResourceNotFoundError);

      expect(mockProjectRoleRepository.getProjectRoleById).not.toHaveBeenCalled();
      expect(mockProjectMemberRepository.createProjectMember).not.toHaveBeenCalled();
    });

    it('should throw a business rule violation and not persist when the projectRoleId does not resolve', async () => {
      await expect(
        projectMemberService.addProjectMember(workspaceOwnerActor, PROJECT_ID, addUnknownRoleInput),
      ).rejects.toThrow(BusinessRuleViolationError);

      expect(mockProjectMemberRepository.createProjectMember).not.toHaveBeenCalled();
    });

    it('should throw a business rule violation and not persist when the projectRoleId resolves to Project Owner', async () => {
      await expect(
        projectMemberService.addProjectMember(
          workspaceOwnerActor,
          PROJECT_ID,
          addProjectOwnerInput,
        ),
      ).rejects.toThrow(BusinessRuleViolationError);

      expect(mockProjectMemberRepository.createProjectMember).not.toHaveBeenCalled();
    });

    it('should throw a business rule violation when a Project Admin attempts to add a Project Admin target (ladder)', async () => {
      await expect(
        projectMemberService.addProjectMember(projectAdminActor, PROJECT_ID, addProjectAdminInput),
      ).rejects.toThrow(BusinessRuleViolationError);

      expect(mockProjectMemberRepository.createProjectMember).not.toHaveBeenCalled();
    });

    it('should propagate repository failures from createProjectMember', async () => {
      mockProjectMemberRepository.createProjectMember.mockRejectedValue(
        new Error('database unavailable'),
      );

      await expect(
        projectMemberService.addProjectMember(workspaceOwnerActor, PROJECT_ID, addDeveloperInput),
      ).rejects.toThrow('database unavailable');
    });
  });

  describe('listProjectMembers', () => {
    beforeEach(() => {
      mockProjectMemberRepository.listProjectMembers.mockResolvedValue([
        projectOwnerMember,
        developerMember,
      ]);
    });

    it('should authorize the actor on the project listProjectMembers action with the resource', async () => {
      await projectMemberService.listProjectMembers(workspaceOwnerActor, PROJECT_ID);

      expect(mockAuthorizationGuard.authorize).toHaveBeenCalledWith({
        actor: workspaceOwnerActor,
        scope: AuthorizationScope.Project,
        action: 'listProjectMembers',
        resource: PROJECT_ID,
      });
    });

    it.each([
      { case: 'Workspace Owner (bypass)', getActor: () => workspaceOwnerActor },
      { case: 'Workspace Admin (bypass)', getActor: () => workspaceAdminActor },
      { case: 'Project Owner member', getActor: () => projectOwnerActor },
      { case: 'Project Admin member', getActor: () => projectAdminActor },
      { case: 'Developer member', getActor: () => projectDeveloperActor },
    ])('should return the full member list for a $case', async ({ getActor }) => {
      const result = await projectMemberService.listProjectMembers(getActor(), PROJECT_ID);

      expect(result).toEqual([projectOwnerMember, developerMember]);
      expect(mockProjectMemberRepository.listProjectMembers).toHaveBeenCalledWith(PROJECT_ID);
    });

    it('should throw an authorization error and perform no reads when the guard rejects the actor', async () => {
      mockAuthorizationGuard.authorize.mockImplementation(() => {
        throw new AuthorizationError();
      });

      await expect(
        projectMemberService.listProjectMembers(workspaceDeveloperActor, PROJECT_ID),
      ).rejects.toThrow(AuthorizationError);

      expect(mockProjectRepository.getProjectById).not.toHaveBeenCalled();
      expect(mockProjectMemberRepository.listProjectMembers).not.toHaveBeenCalled();
    });

    it('should throw a resource not found error when the target project does not exist', async () => {
      mockProjectRepository.getProjectById.mockResolvedValue(null);

      await expect(
        projectMemberService.listProjectMembers(workspaceOwnerActor, PROJECT_ID),
      ).rejects.toThrow(ResourceNotFoundError);

      expect(mockProjectMemberRepository.listProjectMembers).not.toHaveBeenCalled();
    });

    it('should propagate repository failures from listProjectMembers', async () => {
      mockProjectMemberRepository.listProjectMembers.mockRejectedValue(
        new Error('database unavailable'),
      );

      await expect(
        projectMemberService.listProjectMembers(workspaceOwnerActor, PROJECT_ID),
      ).rejects.toThrow('database unavailable');
    });
  });

  describe('updateProjectMemberRole', () => {
    beforeEach(() => {
      mockProjectMemberRepository.getProjectMemberById.mockResolvedValue(developerMember);
      mockProjectMemberRepository.updateProjectMemberRole.mockResolvedValue(
        updatedToProjectAdminMember,
      );
    });

    it('should authorize the actor on the project updateProjectMemberRole action with the resource', async () => {
      await projectMemberService.updateProjectMemberRole(
        workspaceOwnerActor,
        PROJECT_ID,
        DEVELOPER_MEMBER_ID,
        updateToProjectAdminInput,
      );

      expect(mockAuthorizationGuard.authorize).toHaveBeenCalledWith({
        actor: workspaceOwnerActor,
        scope: AuthorizationScope.Project,
        action: 'updateProjectMemberRole',
        resource: PROJECT_ID,
      });
    });

    it.each([
      { case: 'Workspace Owner (bypass)', getActor: () => workspaceOwnerActor },
      { case: 'Project Owner member', getActor: () => projectOwnerActor },
    ])(
      'should update the role and return the expanded member for a $case',
      async ({ getActor }) => {
        const result = await projectMemberService.updateProjectMemberRole(
          getActor(),
          PROJECT_ID,
          DEVELOPER_MEMBER_ID,
          updateToProjectAdminInput,
        );

        expect(result).toEqual(updatedToProjectAdminMember);
        expect(mockProjectMemberRepository.updateProjectMemberRole).toHaveBeenCalledWith(
          DEVELOPER_MEMBER_ID,
          updateToProjectAdminInput.projectRoleId,
        );
      },
    );

    it('should throw an authorization error and perform no reads or writes when the guard rejects the actor', async () => {
      mockAuthorizationGuard.authorize.mockImplementation(() => {
        throw new AuthorizationError();
      });

      await expect(
        projectMemberService.updateProjectMemberRole(
          projectAdminActor,
          PROJECT_ID,
          DEVELOPER_MEMBER_ID,
          updateToProjectAdminInput,
        ),
      ).rejects.toThrow(AuthorizationError);

      expect(mockProjectMemberRepository.getProjectMemberById).not.toHaveBeenCalled();
      expect(mockProjectMemberRepository.updateProjectMemberRole).not.toHaveBeenCalled();
    });

    it('should throw a resource not found error when the target member does not exist', async () => {
      mockProjectMemberRepository.getProjectMemberById.mockResolvedValue(null);

      await expect(
        projectMemberService.updateProjectMemberRole(
          workspaceOwnerActor,
          PROJECT_ID,
          DEVELOPER_MEMBER_ID,
          updateToProjectAdminInput,
        ),
      ).rejects.toThrow(ResourceNotFoundError);

      expect(mockProjectMemberRepository.updateProjectMemberRole).not.toHaveBeenCalled();
    });

    it('should scope the lookup by project id so a member of another project returns 404', async () => {
      mockProjectMemberRepository.getProjectMemberById.mockResolvedValue(null);

      await expect(
        projectMemberService.updateProjectMemberRole(
          workspaceOwnerActor,
          OTHER_PROJECT_ID,
          DEVELOPER_MEMBER_ID,
          updateToProjectAdminInput,
        ),
      ).rejects.toThrow(ResourceNotFoundError);

      expect(mockProjectMemberRepository.getProjectMemberById).toHaveBeenCalledWith(
        DEVELOPER_MEMBER_ID,
        OTHER_PROJECT_ID,
      );
    });

    it('should throw a business rule violation when the target has the Project Owner role (owner-immutable)', async () => {
      mockProjectMemberRepository.getProjectMemberById.mockResolvedValue(projectOwnerMember);

      await expect(
        projectMemberService.updateProjectMemberRole(
          workspaceOwnerActor,
          PROJECT_ID,
          PROJECT_OWNER_MEMBER_ID,
          updateToProjectAdminInput,
        ),
      ).rejects.toThrow(BusinessRuleViolationError);

      expect(mockProjectMemberRepository.updateProjectMemberRole).not.toHaveBeenCalled();
    });

    it('should throw a business rule violation when the target is the actor themselves (self-mutation)', async () => {
      mockProjectMemberRepository.getProjectMemberById.mockResolvedValue(selfDeveloperMember);

      await expect(
        projectMemberService.updateProjectMemberRole(
          workspaceOwnerActor,
          PROJECT_ID,
          DEVELOPER_MEMBER_ID,
          updateToProjectAdminInput,
        ),
      ).rejects.toThrow(BusinessRuleViolationError);

      expect(mockProjectMemberRepository.updateProjectMemberRole).not.toHaveBeenCalled();
    });

    it('should throw a business rule violation when the projectRoleId does not resolve', async () => {
      await expect(
        projectMemberService.updateProjectMemberRole(
          workspaceOwnerActor,
          PROJECT_ID,
          DEVELOPER_MEMBER_ID,
          updateToUnknownRoleInput,
        ),
      ).rejects.toThrow(BusinessRuleViolationError);

      expect(mockProjectMemberRepository.updateProjectMemberRole).not.toHaveBeenCalled();
    });

    it('should throw a business rule violation when the projectRoleId resolves to Project Owner', async () => {
      await expect(
        projectMemberService.updateProjectMemberRole(
          workspaceOwnerActor,
          PROJECT_ID,
          DEVELOPER_MEMBER_ID,
          updateToProjectOwnerInput,
        ),
      ).rejects.toThrow(BusinessRuleViolationError);

      expect(mockProjectMemberRepository.updateProjectMemberRole).not.toHaveBeenCalled();
    });

    it('should propagate repository failures from updateProjectMemberRole', async () => {
      mockProjectMemberRepository.updateProjectMemberRole.mockRejectedValue(
        new Error('database unavailable'),
      );

      await expect(
        projectMemberService.updateProjectMemberRole(
          workspaceOwnerActor,
          PROJECT_ID,
          DEVELOPER_MEMBER_ID,
          updateToProjectAdminInput,
        ),
      ).rejects.toThrow('database unavailable');
    });
  });

  describe('removeProjectMember', () => {
    beforeEach(() => {
      mockProjectMemberRepository.getProjectMemberById.mockResolvedValue(developerMember);
      mockProjectMemberRepository.deleteProjectMember.mockResolvedValue(undefined);
    });

    it('should authorize the actor on the project removeProjectMember action with the resource', async () => {
      await projectMemberService.removeProjectMember(
        workspaceOwnerActor,
        PROJECT_ID,
        DEVELOPER_MEMBER_ID,
      );

      expect(mockAuthorizationGuard.authorize).toHaveBeenCalledWith({
        actor: workspaceOwnerActor,
        scope: AuthorizationScope.Project,
        action: 'removeProjectMember',
        resource: PROJECT_ID,
      });
    });

    it.each([
      { case: 'Workspace Owner (bypass)', getActor: () => workspaceOwnerActor },
      { case: 'Project Owner member', getActor: () => projectOwnerActor },
      { case: 'Project Admin member on a Developer target', getActor: () => projectAdminActor },
    ])('should delete the member for a $case', async ({ getActor }) => {
      await projectMemberService.removeProjectMember(getActor(), PROJECT_ID, DEVELOPER_MEMBER_ID);

      expect(mockProjectMemberRepository.deleteProjectMember).toHaveBeenCalledWith(
        DEVELOPER_MEMBER_ID,
      );
    });

    it('should throw an authorization error and perform no reads or writes when the guard rejects the actor', async () => {
      mockAuthorizationGuard.authorize.mockImplementation(() => {
        throw new AuthorizationError();
      });

      await expect(
        projectMemberService.removeProjectMember(
          projectDeveloperActor,
          PROJECT_ID,
          DEVELOPER_MEMBER_ID,
        ),
      ).rejects.toThrow(AuthorizationError);

      expect(mockProjectMemberRepository.getProjectMemberById).not.toHaveBeenCalled();
      expect(mockProjectMemberRepository.deleteProjectMember).not.toHaveBeenCalled();
    });

    it('should throw a resource not found error when the target member does not exist', async () => {
      mockProjectMemberRepository.getProjectMemberById.mockResolvedValue(null);

      await expect(
        projectMemberService.removeProjectMember(
          workspaceOwnerActor,
          PROJECT_ID,
          DEVELOPER_MEMBER_ID,
        ),
      ).rejects.toThrow(ResourceNotFoundError);

      expect(mockProjectMemberRepository.deleteProjectMember).not.toHaveBeenCalled();
    });

    it('should scope the lookup by project id so a member of another project returns 404', async () => {
      mockProjectMemberRepository.getProjectMemberById.mockResolvedValue(null);

      await expect(
        projectMemberService.removeProjectMember(
          workspaceOwnerActor,
          OTHER_PROJECT_ID,
          DEVELOPER_MEMBER_ID,
        ),
      ).rejects.toThrow(ResourceNotFoundError);

      expect(mockProjectMemberRepository.getProjectMemberById).toHaveBeenCalledWith(
        DEVELOPER_MEMBER_ID,
        OTHER_PROJECT_ID,
      );
    });

    it('should throw a business rule violation when the target has the Project Owner role (owner-protection)', async () => {
      mockProjectMemberRepository.getProjectMemberById.mockResolvedValue(projectOwnerMember);

      await expect(
        projectMemberService.removeProjectMember(
          workspaceOwnerActor,
          PROJECT_ID,
          PROJECT_OWNER_MEMBER_ID,
        ),
      ).rejects.toThrow(BusinessRuleViolationError);

      expect(mockProjectMemberRepository.deleteProjectMember).not.toHaveBeenCalled();
    });

    it('should throw a business rule violation when the target is the actor themselves (self-mutation)', async () => {
      mockProjectMemberRepository.getProjectMemberById.mockResolvedValue(selfDeveloperMember);

      await expect(
        projectMemberService.removeProjectMember(
          workspaceOwnerActor,
          PROJECT_ID,
          DEVELOPER_MEMBER_ID,
        ),
      ).rejects.toThrow(BusinessRuleViolationError);

      expect(mockProjectMemberRepository.deleteProjectMember).not.toHaveBeenCalled();
    });

    it('should throw a business rule violation when a Project Admin attempts to remove a Project Admin target (ladder)', async () => {
      mockProjectMemberRepository.getProjectMemberById.mockResolvedValue(projectAdminMember);

      await expect(
        projectMemberService.removeProjectMember(
          projectAdminActor,
          PROJECT_ID,
          PROJECT_ADMIN_MEMBER_ID,
        ),
      ).rejects.toThrow(BusinessRuleViolationError);

      expect(mockProjectMemberRepository.deleteProjectMember).not.toHaveBeenCalled();
    });

    it('should not apply the ladder for Workspace Owner bypass actors removing a Project Admin target', async () => {
      mockProjectMemberRepository.getProjectMemberById.mockResolvedValue(projectAdminMember);

      await projectMemberService.removeProjectMember(
        workspaceOwnerActor,
        PROJECT_ID,
        PROJECT_ADMIN_MEMBER_ID,
      );

      expect(mockProjectMemberRepository.deleteProjectMember).toHaveBeenCalledWith(
        PROJECT_ADMIN_MEMBER_ID,
      );
    });

    it('should propagate repository failures from deleteProjectMember', async () => {
      mockProjectMemberRepository.deleteProjectMember.mockRejectedValue(
        new Error('database unavailable'),
      );

      await expect(
        projectMemberService.removeProjectMember(
          workspaceOwnerActor,
          PROJECT_ID,
          DEVELOPER_MEMBER_ID,
        ),
      ).rejects.toThrow('database unavailable');
    });
  });
});
