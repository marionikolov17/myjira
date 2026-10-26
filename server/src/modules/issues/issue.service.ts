import { ActorContext } from '@/common/interfaces';
import { ILogger } from '@/common/logger';
import { BusinessRuleViolationError, ResourceNotFoundError } from '@/common/errors';
import { AuthorizationScope, IAuthorizationGuard } from '@/common/authorization';
import { QueryOptions } from '@/common/query';
import { IProjectRepository } from '@/modules/projects/project.interface';
import { IProjectMemberRepository } from '@/modules/project-members';
import { IIssueRepository, IIssueService } from './issue.interface';
import {
  CreateIssueRequestParams,
  Issue,
  IssuePriority,
  IssueStatus,
  UpdateIssueRequestParams,
} from './issue.schema';
import { ListIssuesResult } from './issue.types';

export class IssueService implements IIssueService {
  constructor(
    private readonly issueRepository: IIssueRepository,
    private readonly projectRepository: IProjectRepository,
    private readonly projectMemberRepository: IProjectMemberRepository,
    private readonly authorizationGuard: IAuthorizationGuard,
    private readonly logger: ILogger,
  ) {}

  /**
   * Verifies that `assigneeId` references a user who is a current member of
   * `projectId`. Throws 422 when the user is not a member.
   *
   * The service's caller is responsible for deciding whether to call this
   * (e.g. on create the default-to-creator branch skips it).
   */
  private async assertAssigneeIsMember(projectId: string, assigneeId: string): Promise<void> {
    const member = await this.projectMemberRepository.getProjectMemberByUserAndProject(
      assigneeId,
      projectId,
    );

    if (!member) {
      this.logger.warn('Issue write rejected: assignee is not a project member', {
        projectId,
        assigneeId,
      });
      throw new BusinessRuleViolationError(
        'The specified assignee is not a member of this project',
      );
    }
  }

  public async createIssue(
    actor: ActorContext,
    projectId: string,
    params: CreateIssueRequestParams,
  ): Promise<Issue> {
    this.authorizationGuard.authorize({
      actor,
      scope: AuthorizationScope.Project,
      action: 'createIssue',
      resource: projectId,
    });

    const project = await this.projectRepository.getProjectById(projectId);
    if (!project) {
      this.logger.warn('Issue creation rejected: target project not found', { projectId });
      throw new ResourceNotFoundError({
        resourceName: this.projectRepository.resourceName,
      });
    }

    const assigneeId = params.assigneeId ?? actor.userId;
    if (params.assigneeId !== undefined) {
      await this.assertAssigneeIsMember(projectId, params.assigneeId);
    }

    const priority = params.priority ?? IssuePriority.Medium;

    const issue = await this.issueRepository.createIssue({
      projectId,
      creatorId: actor.userId,
      assigneeId,
      title: params.title,
      description: params.description,
      priority,
      status: IssueStatus.ToDo,
    });

    this.logger.info('Issue created', {
      issueId: issue.id,
      projectId,
      actorId: actor.userId,
    });

    return issue;
  }

  public async listIssues(
    actor: ActorContext,
    projectId: string,
    options: QueryOptions,
  ): Promise<ListIssuesResult> {
    this.authorizationGuard.authorize({
      actor,
      scope: AuthorizationScope.Project,
      action: 'listIssues',
      resource: projectId,
    });

    const project = await this.projectRepository.getProjectById(projectId);
    if (!project) {
      this.logger.warn('Issue listing rejected: target project not found', { projectId });
      throw new ResourceNotFoundError({
        resourceName: this.projectRepository.resourceName,
      });
    }

    return this.issueRepository.findIssues(options, projectId);
  }

  public async getIssueById(
    actor: ActorContext,
    projectId: string,
    issueId: string,
  ): Promise<Issue> {
    this.authorizationGuard.authorize({
      actor,
      scope: AuthorizationScope.Project,
      action: 'getIssueById',
      resource: projectId,
    });

    const issue = await this.issueRepository.getIssueById(issueId, projectId);
    if (!issue) {
      this.logger.warn('Issue retrieval rejected: target issue not found', { issueId, projectId });
      throw new ResourceNotFoundError({
        resourceName: this.issueRepository.resourceName,
      });
    }

    return issue;
  }

  public async updateIssue(
    actor: ActorContext,
    projectId: string,
    issueId: string,
    params: UpdateIssueRequestParams,
  ): Promise<Issue> {
    this.authorizationGuard.authorize({
      actor,
      scope: AuthorizationScope.Project,
      action: 'updateIssue',
      resource: projectId,
    });

    const existing = await this.issueRepository.getIssueById(issueId, projectId);
    if (!existing) {
      this.logger.warn('Issue update rejected: target issue not found', { issueId, projectId });
      throw new ResourceNotFoundError({
        resourceName: this.issueRepository.resourceName,
      });
    }

    if (params.assigneeId !== undefined) {
      await this.assertAssigneeIsMember(projectId, params.assigneeId);
    }

    const updated = await this.issueRepository.updateIssue(issueId, params);

    this.logger.info('Issue updated', {
      issueId,
      projectId,
      actorId: actor.userId,
      changedFields: Object.keys(params),
    });

    return updated;
  }

  public async deleteIssue(actor: ActorContext, projectId: string, issueId: string): Promise<void> {
    this.authorizationGuard.authorize({
      actor,
      scope: AuthorizationScope.Project,
      action: 'deleteIssue',
      resource: projectId,
    });

    const existing = await this.issueRepository.getIssueById(issueId, projectId);
    if (!existing) {
      this.logger.warn('Issue deletion rejected: target issue not found', { issueId, projectId });
      throw new ResourceNotFoundError({
        resourceName: this.issueRepository.resourceName,
      });
    }

    await this.issueRepository.deleteIssue(issueId);

    this.logger.info('Issue deleted', {
      issueId,
      projectId,
      actorId: actor.userId,
    });
  }
}
