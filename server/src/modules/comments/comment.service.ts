import { ActorContext } from '@/common/interfaces';
import { ILogger } from '@/common/logger';
import { AuthorizationError, ResourceNotFoundError } from '@/common/errors';
import { AuthorizationScope, IAuthorizationGuard } from '@/common/authorization';
import { IIssueRepository } from '@/modules/issues/issue.interface';
import { ICommentRepository, ICommentService } from './comment.interface';
import { Comment, CreateCommentRequestParams } from './comment.schema';

export class CommentService implements ICommentService {
  constructor(
    private readonly commentRepository: ICommentRepository,
    private readonly issueRepository: IIssueRepository,
    private readonly authorizationGuard: IAuthorizationGuard,
    private readonly logger: ILogger,
  ) {}

  /**
   * Verifies that `issueId` references an issue that exists within `projectId`.
   * Throws a not-found error for `issues` otherwise, so a mismatched
   * `projectId`/`issueId` pair reads as 404 instead of leaking data.
   */
  private async assertIssueExistsInProject(issueId: string, projectId: string): Promise<void> {
    const issue = await this.issueRepository.getIssueById(issueId, projectId);
    if (!issue) {
      this.logger.warn('Comment action rejected: target issue not found', { issueId, projectId });
      throw new ResourceNotFoundError({
        resourceName: this.issueRepository.resourceName,
      });
    }
  }

  public async listComments(
    actor: ActorContext,
    projectId: string,
    issueId: string,
  ): Promise<Comment[]> {
    this.authorizationGuard.authorize({
      actor,
      scope: AuthorizationScope.Project,
      action: 'listComments',
      resource: projectId,
    });

    await this.assertIssueExistsInProject(issueId, projectId);

    return this.commentRepository.getCommentsByIssueId(issueId);
  }

  public async createComment(
    actor: ActorContext,
    projectId: string,
    issueId: string,
    params: CreateCommentRequestParams,
  ): Promise<Comment> {
    this.authorizationGuard.authorize({
      actor,
      scope: AuthorizationScope.Project,
      action: 'createComment',
      resource: projectId,
    });

    await this.assertIssueExistsInProject(issueId, projectId);

    const comment = await this.commentRepository.createComment({
      issueId,
      creatorId: actor.userId,
      body: params.body,
    });

    this.logger.info('Comment created', {
      commentId: comment.id,
      issueId,
      projectId,
      actorId: actor.userId,
    });

    return comment;
  }

  public async deleteComment(
    actor: ActorContext,
    projectId: string,
    issueId: string,
    commentId: string,
  ): Promise<void> {
    this.authorizationGuard.authorize({
      actor,
      scope: AuthorizationScope.Project,
      action: 'deleteComment',
      resource: projectId,
    });

    await this.assertIssueExistsInProject(issueId, projectId);

    const comment = await this.commentRepository.getCommentById(commentId, issueId);
    if (!comment) {
      this.logger.warn('Comment deletion rejected: target comment not found', {
        commentId,
        issueId,
        projectId,
      });
      throw new ResourceNotFoundError({
        resourceName: this.commentRepository.resourceName,
      });
    }

    if (comment.creator.id !== actor.userId) {
      this.logger.warn('Comment deletion rejected: actor is not the comment creator', {
        commentId,
        issueId,
        projectId,
        actorId: actor.userId,
      });
      throw new AuthorizationError();
    }

    await this.commentRepository.deleteComment(commentId);

    this.logger.info('Comment deleted', {
      commentId,
      issueId,
      projectId,
      actorId: actor.userId,
    });
  }
}
