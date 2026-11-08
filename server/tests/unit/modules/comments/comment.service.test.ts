import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ILogger } from '@/common/logger';
import { IAuthorizationGuard, AuthorizationScope } from '@/common/authorization';
import { AuthorizationError, ResourceNotFoundError } from '@/common/errors';

import { IIssueRepository } from '@/modules/issues';
import { ICommentRepository, ICommentService } from '@/modules/comments';
import { CommentService } from '@/modules/comments/comment.service';

import { createMockLogger } from '../../mocks/logger.mock';
import { createMockAuthorizationGuard } from '../../mocks/authorization-guard.mock';
import { createMockIssueRepository } from '../../mocks/issue.repository.mock';
import { createMockCommentRepository } from '../../mocks/comment.repository.mock';

import {
  ACTOR_USER_ID,
  COMMENT_ID,
  ISSUE_ID,
  OTHER_PROJECT_ID,
  PROJECT_ID,
  createCommentInput,
  createdComment,
  existingIssue,
  otherUsersComment,
  projectAdminActor,
  projectDeveloperActor,
  projectOwnerActor,
  workspaceAdminActor,
  workspaceDeveloperActor,
  workspaceOwnerActor,
} from './comment.service.mock';

describe('CommentService', () => {
  let mockCommentRepository: jest.Mocked<ICommentRepository>;
  let mockIssueRepository: jest.Mocked<IIssueRepository>;
  let mockAuthorizationGuard: jest.Mocked<IAuthorizationGuard>;
  let mockLogger: jest.Mocked<ILogger>;

  let commentService: ICommentService;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();

    mockCommentRepository = createMockCommentRepository();
    mockIssueRepository = createMockIssueRepository();
    mockAuthorizationGuard = createMockAuthorizationGuard();
    mockLogger = createMockLogger();

    mockIssueRepository.getIssueById.mockResolvedValue(existingIssue);

    commentService = new CommentService(
      mockCommentRepository,
      mockIssueRepository,
      mockAuthorizationGuard,
      mockLogger,
    );
  });

  describe('listComments', () => {
    beforeEach(() => {
      mockCommentRepository.getCommentsByIssueId.mockResolvedValue([
        createdComment,
        otherUsersComment,
      ]);
    });

    it('should authorize the actor on the project listComments action with the resource', async () => {
      await commentService.listComments(projectOwnerActor, PROJECT_ID, ISSUE_ID);

      expect(mockAuthorizationGuard.authorize).toHaveBeenCalledWith({
        actor: projectOwnerActor,
        scope: AuthorizationScope.Project,
        action: 'listComments',
        resource: PROJECT_ID,
      });
    });

    it.each([
      { case: 'Workspace Owner (bypass)', getActor: () => workspaceOwnerActor },
      { case: 'Workspace Admin (bypass)', getActor: () => workspaceAdminActor },
      { case: 'Project Owner member', getActor: () => projectOwnerActor },
      { case: 'Project Admin member', getActor: () => projectAdminActor },
      { case: 'Developer member', getActor: () => projectDeveloperActor },
    ])('should return the issue comments for a $case', async ({ getActor }) => {
      const result = await commentService.listComments(getActor(), PROJECT_ID, ISSUE_ID);

      expect(result).toEqual([createdComment, otherUsersComment]);
      expect(mockCommentRepository.getCommentsByIssueId).toHaveBeenCalledWith(ISSUE_ID);
    });

    it('should throw an authorization error and perform no reads when a non-member Developer is rejected', async () => {
      mockAuthorizationGuard.authorize.mockImplementation(() => {
        throw new AuthorizationError();
      });

      await expect(
        commentService.listComments(workspaceDeveloperActor, PROJECT_ID, ISSUE_ID),
      ).rejects.toThrow(AuthorizationError);

      expect(mockIssueRepository.getIssueById).not.toHaveBeenCalled();
      expect(mockCommentRepository.getCommentsByIssueId).not.toHaveBeenCalled();
    });

    it('should throw a resource not found error for issues when the target issue does not exist in the project', async () => {
      mockIssueRepository.getIssueById.mockResolvedValue(null);

      await expect(
        commentService.listComments(projectOwnerActor, OTHER_PROJECT_ID, ISSUE_ID),
      ).rejects.toThrow(ResourceNotFoundError);

      expect(mockIssueRepository.getIssueById).toHaveBeenCalledWith(ISSUE_ID, OTHER_PROJECT_ID);
      expect(mockCommentRepository.getCommentsByIssueId).not.toHaveBeenCalled();
    });

    it('should propagate repository failures from getCommentsByIssueId', async () => {
      mockCommentRepository.getCommentsByIssueId.mockRejectedValue(
        new Error('database unavailable'),
      );

      await expect(
        commentService.listComments(projectOwnerActor, PROJECT_ID, ISSUE_ID),
      ).rejects.toThrow('database unavailable');
    });
  });

  describe('createComment', () => {
    beforeEach(() => {
      mockCommentRepository.createComment.mockResolvedValue(createdComment);
    });

    it('should authorize the actor on the project createComment action with the resource', async () => {
      await commentService.createComment(
        projectOwnerActor,
        PROJECT_ID,
        ISSUE_ID,
        createCommentInput,
      );

      expect(mockAuthorizationGuard.authorize).toHaveBeenCalledWith({
        actor: projectOwnerActor,
        scope: AuthorizationScope.Project,
        action: 'createComment',
        resource: PROJECT_ID,
      });
    });

    it.each([
      { case: 'Workspace Owner (bypass)', getActor: () => workspaceOwnerActor },
      { case: 'Workspace Admin (bypass)', getActor: () => workspaceAdminActor },
      { case: 'Project Owner member', getActor: () => projectOwnerActor },
      { case: 'Project Admin member', getActor: () => projectAdminActor },
      { case: 'Developer member', getActor: () => projectDeveloperActor },
    ])('should create the comment when the actor is a $case', async ({ getActor }) => {
      const result = await commentService.createComment(
        getActor(),
        PROJECT_ID,
        ISSUE_ID,
        createCommentInput,
      );

      expect(result).toEqual(createdComment);
      expect(mockCommentRepository.createComment).toHaveBeenCalledTimes(1);
    });

    it('should attribute the created comment to the actor by setting creatorId from actor.userId', async () => {
      await commentService.createComment(
        projectOwnerActor,
        PROJECT_ID,
        ISSUE_ID,
        createCommentInput,
      );

      expect(mockCommentRepository.createComment).toHaveBeenCalledWith({
        issueId: ISSUE_ID,
        creatorId: ACTOR_USER_ID,
        body: createCommentInput.body,
      });
    });

    it('should throw an authorization error and perform no reads or writes when the actor is rejected', async () => {
      mockAuthorizationGuard.authorize.mockImplementation(() => {
        throw new AuthorizationError();
      });

      await expect(
        commentService.createComment(
          workspaceDeveloperActor,
          PROJECT_ID,
          ISSUE_ID,
          createCommentInput,
        ),
      ).rejects.toThrow(AuthorizationError);

      expect(mockIssueRepository.getIssueById).not.toHaveBeenCalled();
      expect(mockCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should throw a resource not found error for issues and not persist when the target issue does not exist in the project', async () => {
      mockIssueRepository.getIssueById.mockResolvedValue(null);

      await expect(
        commentService.createComment(projectOwnerActor, PROJECT_ID, ISSUE_ID, createCommentInput),
      ).rejects.toThrow(ResourceNotFoundError);

      expect(mockCommentRepository.createComment).not.toHaveBeenCalled();
    });

    it('should log the created comment on success', async () => {
      await commentService.createComment(
        projectOwnerActor,
        PROJECT_ID,
        ISSUE_ID,
        createCommentInput,
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Comment created',
        expect.objectContaining({
          commentId: COMMENT_ID,
          issueId: ISSUE_ID,
          projectId: PROJECT_ID,
          actorId: ACTOR_USER_ID,
        }),
      );
    });

    it('should propagate repository failures from createComment', async () => {
      mockCommentRepository.createComment.mockRejectedValue(new Error('database unavailable'));

      await expect(
        commentService.createComment(projectOwnerActor, PROJECT_ID, ISSUE_ID, createCommentInput),
      ).rejects.toThrow('database unavailable');
    });
  });

  describe('deleteComment', () => {
    beforeEach(() => {
      mockCommentRepository.getCommentById.mockResolvedValue(createdComment);
      mockCommentRepository.deleteComment.mockResolvedValue(undefined);
    });

    it('should authorize the actor on the project deleteComment action with the resource', async () => {
      await commentService.deleteComment(projectOwnerActor, PROJECT_ID, ISSUE_ID, COMMENT_ID);

      expect(mockAuthorizationGuard.authorize).toHaveBeenCalledWith({
        actor: projectOwnerActor,
        scope: AuthorizationScope.Project,
        action: 'deleteComment',
        resource: PROJECT_ID,
      });
    });

    it('should delete the comment when the actor is its creator', async () => {
      await commentService.deleteComment(projectOwnerActor, PROJECT_ID, ISSUE_ID, COMMENT_ID);

      expect(mockCommentRepository.getCommentById).toHaveBeenCalledWith(COMMENT_ID, ISSUE_ID);
      expect(mockCommentRepository.deleteComment).toHaveBeenCalledWith(COMMENT_ID);
    });

    it('should throw an authorization error and not delete when the actor is not the comment creator', async () => {
      mockCommentRepository.getCommentById.mockResolvedValue(otherUsersComment);

      await expect(
        commentService.deleteComment(projectOwnerActor, PROJECT_ID, ISSUE_ID, COMMENT_ID),
      ).rejects.toThrow(AuthorizationError);

      expect(mockCommentRepository.deleteComment).not.toHaveBeenCalled();
    });

    it('should throw an authorization error and perform no reads or writes when the role check fails', async () => {
      mockAuthorizationGuard.authorize.mockImplementation(() => {
        throw new AuthorizationError();
      });

      await expect(
        commentService.deleteComment(workspaceDeveloperActor, PROJECT_ID, ISSUE_ID, COMMENT_ID),
      ).rejects.toThrow(AuthorizationError);

      expect(mockIssueRepository.getIssueById).not.toHaveBeenCalled();
      expect(mockCommentRepository.getCommentById).not.toHaveBeenCalled();
      expect(mockCommentRepository.deleteComment).not.toHaveBeenCalled();
    });

    it('should throw a resource not found error for issues and not read the comment when the target issue does not exist in the project', async () => {
      mockIssueRepository.getIssueById.mockResolvedValue(null);

      await expect(
        commentService.deleteComment(projectOwnerActor, OTHER_PROJECT_ID, ISSUE_ID, COMMENT_ID),
      ).rejects.toThrow(ResourceNotFoundError);

      expect(mockCommentRepository.getCommentById).not.toHaveBeenCalled();
      expect(mockCommentRepository.deleteComment).not.toHaveBeenCalled();
    });

    it('should throw a resource not found error for comments and not delete when the comment does not exist on the issue', async () => {
      mockCommentRepository.getCommentById.mockResolvedValue(null);

      await expect(
        commentService.deleteComment(projectOwnerActor, PROJECT_ID, ISSUE_ID, COMMENT_ID),
      ).rejects.toThrow(ResourceNotFoundError);

      expect(mockCommentRepository.getCommentById).toHaveBeenCalledWith(COMMENT_ID, ISSUE_ID);
      expect(mockCommentRepository.deleteComment).not.toHaveBeenCalled();
    });

    it('should propagate repository failures from deleteComment', async () => {
      mockCommentRepository.deleteComment.mockRejectedValue(new Error('database unavailable'));

      await expect(
        commentService.deleteComment(projectOwnerActor, PROJECT_ID, ISSUE_ID, COMMENT_ID),
      ).rejects.toThrow('database unavailable');
    });
  });
});
