import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ILogger } from '@/common/logger';
import { IAuthorizationGuard, AuthorizationScope } from '@/common/authorization';
import {
  AuthorizationError,
  BusinessRuleViolationError,
  ResourceNotFoundError,
} from '@/common/errors';
import { QueryOptions } from '@/common/query';

import { IProjectRepository } from '@/modules/projects/project.interface';
import { IProjectMemberRepository } from '@/modules/project-members';
import { IIssueRepository, IIssueService, IssuePriority, IssueStatus } from '@/modules/issues';
import { IssueService } from '@/modules/issues/issue.service';

import { createMockLogger } from '../../mocks/logger.mock';
import { createMockAuthorizationGuard } from '../../mocks/authorization-guard.mock';
import { createMockProjectRepository } from '../../mocks/project.repository.mock';
import { createMockProjectMemberRepository } from '../../mocks/project-member.repository.mock';
import { createMockIssueRepository } from '../../mocks/issue.repository.mock';

import {
  ACTOR_USER_ID,
  ISSUE_ID,
  MEMBER_USER_ID,
  OTHER_PROJECT_ID,
  PROJECT_ID,
  createIssueInputNoAssignee,
  createIssueInputWithMemberAssignee,
  createIssueInputWithNonMemberAssignee,
  createIssueInputWithPriority,
  createdIssue,
  memberProjectMember,
  project,
  projectAdminActor,
  projectDeveloperActor,
  projectOwnerActor,
  updateIssueTitleInput,
  updateIssueWithMemberAssigneeInput,
  updateIssueWithNonMemberAssigneeInput,
  updatedIssue,
  workspaceAdminActor,
  workspaceDeveloperActor,
  workspaceOwnerActor,
} from './issue.service.mock';

describe('IssueService', () => {
  let mockIssueRepository: jest.Mocked<IIssueRepository>;
  let mockProjectRepository: jest.Mocked<IProjectRepository>;
  let mockProjectMemberRepository: jest.Mocked<IProjectMemberRepository>;
  let mockAuthorizationGuard: jest.Mocked<IAuthorizationGuard>;
  let mockLogger: jest.Mocked<ILogger>;

  let issueService: IIssueService;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();

    mockIssueRepository = createMockIssueRepository();
    mockProjectRepository = createMockProjectRepository();
    mockProjectMemberRepository = createMockProjectMemberRepository();
    mockAuthorizationGuard = createMockAuthorizationGuard();
    mockLogger = createMockLogger();

    mockProjectRepository.getProjectById.mockResolvedValue(project);
    mockProjectMemberRepository.getProjectMemberByUserAndProject.mockResolvedValue(
      memberProjectMember,
    );

    issueService = new IssueService(
      mockIssueRepository,
      mockProjectRepository,
      mockProjectMemberRepository,
      mockAuthorizationGuard,
      mockLogger,
    );
  });

  describe('createIssue', () => {
    beforeEach(() => {
      mockIssueRepository.createIssue.mockResolvedValue(createdIssue);
    });

    it('should authorize the actor on the project createIssue action with the resource', async () => {
      await issueService.createIssue(projectOwnerActor, PROJECT_ID, createIssueInputNoAssignee);

      expect(mockAuthorizationGuard.authorize).toHaveBeenCalledWith({
        actor: projectOwnerActor,
        scope: AuthorizationScope.Project,
        action: 'createIssue',
        resource: PROJECT_ID,
      });
    });

    it.each([
      { case: 'Project Owner', getActor: () => projectOwnerActor },
      { case: 'Project Admin', getActor: () => projectAdminActor },
      { case: 'Developer', getActor: () => projectDeveloperActor },
    ])('should create the issue when the actor is a $case', async ({ getActor }) => {
      const result = await issueService.createIssue(
        getActor(),
        PROJECT_ID,
        createIssueInputNoAssignee,
      );

      expect(result).toEqual(createdIssue);
      expect(mockIssueRepository.createIssue).toHaveBeenCalledTimes(1);
    });

    it.each([
      { case: 'Workspace Owner without a project role', getActor: () => workspaceOwnerActor },
      { case: 'Workspace Admin without a project role', getActor: () => workspaceAdminActor },
      { case: 'non-member Developer', getActor: () => workspaceDeveloperActor },
    ])(
      'should throw an authorization error and perform no reads or writes when a $case is rejected',
      async ({ getActor }) => {
        mockAuthorizationGuard.authorize.mockImplementation(() => {
          throw new AuthorizationError();
        });

        await expect(
          issueService.createIssue(getActor(), PROJECT_ID, createIssueInputNoAssignee),
        ).rejects.toThrow(AuthorizationError);

        expect(mockProjectRepository.getProjectById).not.toHaveBeenCalled();
        expect(mockProjectMemberRepository.getProjectMemberByUserAndProject).not.toHaveBeenCalled();
        expect(mockIssueRepository.createIssue).not.toHaveBeenCalled();
      },
    );

    it('should default assigneeId to the actor and skip the assignee-is-member check when assigneeId is omitted', async () => {
      await issueService.createIssue(projectOwnerActor, PROJECT_ID, createIssueInputNoAssignee);

      expect(mockProjectMemberRepository.getProjectMemberByUserAndProject).not.toHaveBeenCalled();
      expect(mockIssueRepository.createIssue).toHaveBeenCalledWith({
        projectId: PROJECT_ID,
        creatorId: ACTOR_USER_ID,
        assigneeId: ACTOR_USER_ID,
        title: createIssueInputNoAssignee.title,
        description: createIssueInputNoAssignee.description,
        priority: IssuePriority.Medium,
        status: IssueStatus.ToDo,
      });
    });

    it('should default priority to Medium when priority is omitted', async () => {
      await issueService.createIssue(projectOwnerActor, PROJECT_ID, createIssueInputNoAssignee);

      expect(mockIssueRepository.createIssue).toHaveBeenCalledWith(
        expect.objectContaining({ priority: IssuePriority.Medium }),
      );
    });

    it('should honor the provided priority when supplied', async () => {
      await issueService.createIssue(projectOwnerActor, PROJECT_ID, createIssueInputWithPriority);

      expect(mockIssueRepository.createIssue).toHaveBeenCalledWith(
        expect.objectContaining({ priority: IssuePriority.High }),
      );
    });

    it('should always set status to ToDo on create', async () => {
      await issueService.createIssue(projectOwnerActor, PROJECT_ID, createIssueInputNoAssignee);

      expect(mockIssueRepository.createIssue).toHaveBeenCalledWith(
        expect.objectContaining({ status: IssueStatus.ToDo }),
      );
    });

    it('should verify the assignee is a current project member when assigneeId is explicitly supplied and proceed when they are a member', async () => {
      await issueService.createIssue(
        projectOwnerActor,
        PROJECT_ID,
        createIssueInputWithMemberAssignee,
      );

      expect(mockProjectMemberRepository.getProjectMemberByUserAndProject).toHaveBeenCalledWith(
        MEMBER_USER_ID,
        PROJECT_ID,
      );
      expect(mockIssueRepository.createIssue).toHaveBeenCalledWith(
        expect.objectContaining({ assigneeId: MEMBER_USER_ID }),
      );
    });

    it('should throw a business rule violation and not persist when the supplied assignee is not a project member', async () => {
      mockProjectMemberRepository.getProjectMemberByUserAndProject.mockResolvedValue(null);

      await expect(
        issueService.createIssue(
          projectOwnerActor,
          PROJECT_ID,
          createIssueInputWithNonMemberAssignee,
        ),
      ).rejects.toThrow(BusinessRuleViolationError);

      expect(mockIssueRepository.createIssue).not.toHaveBeenCalled();
    });

    it('should throw a resource not found error and not persist when the target project does not exist', async () => {
      mockProjectRepository.getProjectById.mockResolvedValue(null);

      await expect(
        issueService.createIssue(projectOwnerActor, PROJECT_ID, createIssueInputNoAssignee),
      ).rejects.toThrow(ResourceNotFoundError);

      expect(mockProjectMemberRepository.getProjectMemberByUserAndProject).not.toHaveBeenCalled();
      expect(mockIssueRepository.createIssue).not.toHaveBeenCalled();
    });

    it('should log the created issue on success', async () => {
      await issueService.createIssue(projectOwnerActor, PROJECT_ID, createIssueInputNoAssignee);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Issue created',
        expect.objectContaining({
          issueId: ISSUE_ID,
          projectId: PROJECT_ID,
          actorId: ACTOR_USER_ID,
        }),
      );
    });

    it('should propagate repository failures from createIssue', async () => {
      mockIssueRepository.createIssue.mockRejectedValue(new Error('database unavailable'));

      await expect(
        issueService.createIssue(projectOwnerActor, PROJECT_ID, createIssueInputNoAssignee),
      ).rejects.toThrow('database unavailable');
    });
  });

  describe('listIssues', () => {
    const options: QueryOptions = {
      pagination: { page: 1, pageSize: 10 },
      sort: [],
      filters: [],
    };

    beforeEach(() => {
      mockIssueRepository.findIssues.mockResolvedValue({ items: [createdIssue], totalItems: 1 });
    });

    it('should authorize the actor on the project listIssues action with the resource', async () => {
      await issueService.listIssues(projectOwnerActor, PROJECT_ID, options);

      expect(mockAuthorizationGuard.authorize).toHaveBeenCalledWith({
        actor: projectOwnerActor,
        scope: AuthorizationScope.Project,
        action: 'listIssues',
        resource: PROJECT_ID,
      });
    });

    it.each([
      { case: 'Workspace Owner (bypass)', getActor: () => workspaceOwnerActor },
      { case: 'Workspace Admin (bypass)', getActor: () => workspaceAdminActor },
      { case: 'Project Owner member', getActor: () => projectOwnerActor },
      { case: 'Project Admin member', getActor: () => projectAdminActor },
      { case: 'Developer member', getActor: () => projectDeveloperActor },
    ])('should return the paginated list for a $case', async ({ getActor }) => {
      const result = await issueService.listIssues(getActor(), PROJECT_ID, options);

      expect(result).toEqual({ items: [createdIssue], totalItems: 1 });
      expect(mockIssueRepository.findIssues).toHaveBeenCalledWith(options, PROJECT_ID);
    });

    it('should throw an authorization error and perform no reads when a non-member Developer is rejected', async () => {
      mockAuthorizationGuard.authorize.mockImplementation(() => {
        throw new AuthorizationError();
      });

      await expect(
        issueService.listIssues(workspaceDeveloperActor, PROJECT_ID, options),
      ).rejects.toThrow(AuthorizationError);

      expect(mockProjectRepository.getProjectById).not.toHaveBeenCalled();
      expect(mockIssueRepository.findIssues).not.toHaveBeenCalled();
    });

    it('should throw a resource not found error and not call the repository when the target project does not exist', async () => {
      mockProjectRepository.getProjectById.mockResolvedValue(null);

      await expect(
        issueService.listIssues(workspaceOwnerActor, PROJECT_ID, options),
      ).rejects.toThrow(ResourceNotFoundError);

      expect(mockIssueRepository.findIssues).not.toHaveBeenCalled();
    });

    it('should propagate repository failures from findIssues', async () => {
      mockIssueRepository.findIssues.mockRejectedValue(new Error('database unavailable'));

      await expect(
        issueService.listIssues(workspaceOwnerActor, PROJECT_ID, options),
      ).rejects.toThrow('database unavailable');
    });
  });

  describe('getIssueById', () => {
    beforeEach(() => {
      mockIssueRepository.getIssueById.mockResolvedValue(createdIssue);
    });

    it('should authorize the actor on the project getIssueById action with the resource', async () => {
      await issueService.getIssueById(projectOwnerActor, PROJECT_ID, ISSUE_ID);

      expect(mockAuthorizationGuard.authorize).toHaveBeenCalledWith({
        actor: projectOwnerActor,
        scope: AuthorizationScope.Project,
        action: 'getIssueById',
        resource: PROJECT_ID,
      });
    });

    it.each([
      { case: 'Workspace Owner (bypass)', getActor: () => workspaceOwnerActor },
      { case: 'Workspace Admin (bypass)', getActor: () => workspaceAdminActor },
      { case: 'Project Owner member', getActor: () => projectOwnerActor },
      { case: 'Project Admin member', getActor: () => projectAdminActor },
      { case: 'Developer member', getActor: () => projectDeveloperActor },
    ])('should return the issue scoped to the project for a $case', async ({ getActor }) => {
      const result = await issueService.getIssueById(getActor(), PROJECT_ID, ISSUE_ID);

      expect(result).toEqual(createdIssue);
      expect(mockIssueRepository.getIssueById).toHaveBeenCalledWith(ISSUE_ID, PROJECT_ID);
    });

    it('should throw an authorization error and perform no reads when a non-member Developer is rejected', async () => {
      mockAuthorizationGuard.authorize.mockImplementation(() => {
        throw new AuthorizationError();
      });

      await expect(
        issueService.getIssueById(workspaceDeveloperActor, PROJECT_ID, ISSUE_ID),
      ).rejects.toThrow(AuthorizationError);

      expect(mockIssueRepository.getIssueById).not.toHaveBeenCalled();
    });

    it('should throw a resource not found error when the repository returns null for the (issueId, projectId) pair', async () => {
      mockIssueRepository.getIssueById.mockResolvedValue(null);

      await expect(
        issueService.getIssueById(workspaceOwnerActor, OTHER_PROJECT_ID, ISSUE_ID),
      ).rejects.toThrow(ResourceNotFoundError);

      expect(mockIssueRepository.getIssueById).toHaveBeenCalledWith(ISSUE_ID, OTHER_PROJECT_ID);
    });

    it('should propagate repository failures from getIssueById', async () => {
      mockIssueRepository.getIssueById.mockRejectedValue(new Error('database unavailable'));

      await expect(
        issueService.getIssueById(workspaceOwnerActor, PROJECT_ID, ISSUE_ID),
      ).rejects.toThrow('database unavailable');
    });
  });

  describe('updateIssue', () => {
    beforeEach(() => {
      mockIssueRepository.getIssueById.mockResolvedValue(createdIssue);
      mockIssueRepository.updateIssue.mockResolvedValue(updatedIssue);
    });

    it('should authorize the actor on the project updateIssue action with the resource', async () => {
      await issueService.updateIssue(
        projectOwnerActor,
        PROJECT_ID,
        ISSUE_ID,
        updateIssueTitleInput,
      );

      expect(mockAuthorizationGuard.authorize).toHaveBeenCalledWith({
        actor: projectOwnerActor,
        scope: AuthorizationScope.Project,
        action: 'updateIssue',
        resource: PROJECT_ID,
      });
    });

    it.each([
      { case: 'Project Owner', getActor: () => projectOwnerActor },
      { case: 'Project Admin', getActor: () => projectAdminActor },
      { case: 'Developer', getActor: () => projectDeveloperActor },
    ])('should update the issue when the actor is a $case', async ({ getActor }) => {
      const result = await issueService.updateIssue(
        getActor(),
        PROJECT_ID,
        ISSUE_ID,
        updateIssueTitleInput,
      );

      expect(result).toEqual(updatedIssue);
      expect(mockIssueRepository.updateIssue).toHaveBeenCalledWith(ISSUE_ID, updateIssueTitleInput);
    });

    it.each([
      { case: 'Workspace Owner without a project role', getActor: () => workspaceOwnerActor },
      { case: 'Workspace Admin without a project role', getActor: () => workspaceAdminActor },
      { case: 'non-member Developer', getActor: () => workspaceDeveloperActor },
    ])(
      'should throw an authorization error and perform no reads or writes when a $case is rejected',
      async ({ getActor }) => {
        mockAuthorizationGuard.authorize.mockImplementation(() => {
          throw new AuthorizationError();
        });

        await expect(
          issueService.updateIssue(getActor(), PROJECT_ID, ISSUE_ID, updateIssueTitleInput),
        ).rejects.toThrow(AuthorizationError);

        expect(mockIssueRepository.getIssueById).not.toHaveBeenCalled();
        expect(mockIssueRepository.updateIssue).not.toHaveBeenCalled();
      },
    );

    it('should throw a resource not found error and not write when the repository returns null for the (issueId, projectId) pair', async () => {
      mockIssueRepository.getIssueById.mockResolvedValue(null);

      await expect(
        issueService.updateIssue(
          projectOwnerActor,
          OTHER_PROJECT_ID,
          ISSUE_ID,
          updateIssueTitleInput,
        ),
      ).rejects.toThrow(ResourceNotFoundError);

      expect(mockIssueRepository.getIssueById).toHaveBeenCalledWith(ISSUE_ID, OTHER_PROJECT_ID);
      expect(mockIssueRepository.updateIssue).not.toHaveBeenCalled();
    });

    it('should skip the assignee-is-member check when assigneeId is omitted', async () => {
      await issueService.updateIssue(
        projectOwnerActor,
        PROJECT_ID,
        ISSUE_ID,
        updateIssueTitleInput,
      );

      expect(mockProjectMemberRepository.getProjectMemberByUserAndProject).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateIssue).toHaveBeenCalledWith(ISSUE_ID, updateIssueTitleInput);
    });

    it('should verify the supplied assignee is a current project member and proceed when they are a member', async () => {
      await issueService.updateIssue(
        projectOwnerActor,
        PROJECT_ID,
        ISSUE_ID,
        updateIssueWithMemberAssigneeInput,
      );

      expect(mockProjectMemberRepository.getProjectMemberByUserAndProject).toHaveBeenCalledWith(
        MEMBER_USER_ID,
        PROJECT_ID,
      );
      expect(mockIssueRepository.updateIssue).toHaveBeenCalledWith(
        ISSUE_ID,
        updateIssueWithMemberAssigneeInput,
      );
    });

    it('should throw a business rule violation and not write when the supplied assignee is not a project member', async () => {
      mockProjectMemberRepository.getProjectMemberByUserAndProject.mockResolvedValue(null);

      await expect(
        issueService.updateIssue(
          projectOwnerActor,
          PROJECT_ID,
          ISSUE_ID,
          updateIssueWithNonMemberAssigneeInput,
        ),
      ).rejects.toThrow(BusinessRuleViolationError);

      expect(mockIssueRepository.updateIssue).not.toHaveBeenCalled();
    });

    it('should propagate repository failures from updateIssue', async () => {
      mockIssueRepository.updateIssue.mockRejectedValue(new Error('database unavailable'));

      await expect(
        issueService.updateIssue(projectOwnerActor, PROJECT_ID, ISSUE_ID, updateIssueTitleInput),
      ).rejects.toThrow('database unavailable');
    });
  });

  describe('deleteIssue', () => {
    beforeEach(() => {
      mockIssueRepository.getIssueById.mockResolvedValue(createdIssue);
      mockIssueRepository.deleteIssue.mockResolvedValue(undefined);
    });

    it('should authorize the actor on the project deleteIssue action with the resource', async () => {
      await issueService.deleteIssue(projectOwnerActor, PROJECT_ID, ISSUE_ID);

      expect(mockAuthorizationGuard.authorize).toHaveBeenCalledWith({
        actor: projectOwnerActor,
        scope: AuthorizationScope.Project,
        action: 'deleteIssue',
        resource: PROJECT_ID,
      });
    });

    it.each([
      { case: 'Project Owner', getActor: () => projectOwnerActor },
      { case: 'Project Admin', getActor: () => projectAdminActor },
      { case: 'Developer', getActor: () => projectDeveloperActor },
    ])('should delete the issue when the actor is a $case', async ({ getActor }) => {
      await issueService.deleteIssue(getActor(), PROJECT_ID, ISSUE_ID);

      expect(mockIssueRepository.deleteIssue).toHaveBeenCalledWith(ISSUE_ID);
    });

    it.each([
      { case: 'Workspace Owner without a project role', getActor: () => workspaceOwnerActor },
      { case: 'Workspace Admin without a project role', getActor: () => workspaceAdminActor },
      { case: 'non-member Developer', getActor: () => workspaceDeveloperActor },
    ])(
      'should throw an authorization error and perform no reads or writes when a $case is rejected',
      async ({ getActor }) => {
        mockAuthorizationGuard.authorize.mockImplementation(() => {
          throw new AuthorizationError();
        });

        await expect(issueService.deleteIssue(getActor(), PROJECT_ID, ISSUE_ID)).rejects.toThrow(
          AuthorizationError,
        );

        expect(mockIssueRepository.getIssueById).not.toHaveBeenCalled();
        expect(mockIssueRepository.deleteIssue).not.toHaveBeenCalled();
      },
    );

    it('should throw a resource not found error and not delete when the repository returns null for the (issueId, projectId) pair', async () => {
      mockIssueRepository.getIssueById.mockResolvedValue(null);

      await expect(
        issueService.deleteIssue(projectOwnerActor, OTHER_PROJECT_ID, ISSUE_ID),
      ).rejects.toThrow(ResourceNotFoundError);

      expect(mockIssueRepository.getIssueById).toHaveBeenCalledWith(ISSUE_ID, OTHER_PROJECT_ID);
      expect(mockIssueRepository.deleteIssue).not.toHaveBeenCalled();
    });

    it('should propagate repository failures from deleteIssue', async () => {
      mockIssueRepository.deleteIssue.mockRejectedValue(new Error('database unavailable'));

      await expect(
        issueService.deleteIssue(projectOwnerActor, PROJECT_ID, ISSUE_ID),
      ).rejects.toThrow('database unavailable');
    });
  });
});
