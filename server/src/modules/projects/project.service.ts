import { ActorContext } from '@/common/interfaces';
import { ILogger } from '@/common/logger';
import { ResourceNotFoundError } from '@/common/errors';
import { AuthorizationScope, IAuthorizationGuard } from '@/common/authorization';
import { QueryOptions } from '@/common/query';
import { IUnitOfWork } from '@/common/unit-of-work';
import { IProjectMemberRepository, ProjectRoleName } from '@/modules/project-members';
import { WorkspaceRoleName } from '@/modules/workspace-roles';
import { IProjectRepository, IProjectService } from './project.interface';
import { ActorMembershipFilter, ListProjectsResult } from './project.types';
import { CreateProjectRequestParams, Project, UpdateProjectRequestParams } from './project.schema';

export class ProjectService implements IProjectService {
  constructor(
    private readonly projectRepository: IProjectRepository,
    private readonly projectMemberRepository: IProjectMemberRepository,
    private readonly authorizationGuard: IAuthorizationGuard,
    private readonly unitOfWork: IUnitOfWork,
    private readonly logger: ILogger,
  ) {}

  public async createProject(
    actor: ActorContext,
    params: CreateProjectRequestParams,
  ): Promise<Project> {
    this.authorizationGuard.authorize({
      actor,
      scope: AuthorizationScope.Workspace,
      action: 'createProject',
    });

    const projectOwnerRoleId = await this.projectMemberRepository.getProjectRoleIdByName(
      ProjectRoleName.PROJECT_OWNER,
    );

    const project = await this.unitOfWork.run(async (tx) => {
      const created = await tx.projects.createProject({
        name: params.name,
        description: params.description,
        creatorId: actor.userId,
      });

      await tx.projectMembers.createProjectMember({
        projectId: created.id,
        userId: actor.userId,
        projectRoleId: projectOwnerRoleId,
      });

      return created;
    });

    this.logger.info('Project created', { projectId: project.id, creatorId: actor.userId });

    return project;
  }

  public async listProjects(
    actor: ActorContext,
    options: QueryOptions,
  ): Promise<ListProjectsResult> {
    this.authorizationGuard.authorize({
      actor,
      scope: AuthorizationScope.Workspace,
      action: 'listProjects',
    });

    const membershipFilter = this.buildActorMembershipFilter(actor);

    return this.projectRepository.findProjects(options, membershipFilter);
  }

  private buildActorMembershipFilter(actor: ActorContext): ActorMembershipFilter {
    if (
      actor.workspaceRole.name === WorkspaceRoleName.OWNER ||
      actor.workspaceRole.name === WorkspaceRoleName.ADMIN
    ) {
      return undefined;
    }
    return { userId: actor.userId };
  }

  public async getProjectById(actor: ActorContext, projectId: string): Promise<Project> {
    this.authorizationGuard.authorize({
      actor,
      scope: AuthorizationScope.Project,
      action: 'getProjectById',
      resource: projectId,
    });

    const project = await this.projectRepository.getProjectById(projectId);

    if (!project) {
      this.logger.warn('Project retrieval rejected: target project not found', { projectId });
      throw new ResourceNotFoundError({
        resourceName: this.projectRepository.resourceName,
      });
    }

    return project;
  }

  public async updateProject(
    actor: ActorContext,
    projectId: string,
    params: UpdateProjectRequestParams,
  ): Promise<Project> {
    this.authorizationGuard.authorize({
      actor,
      scope: AuthorizationScope.Project,
      action: 'updateProject',
      resource: projectId,
    });

    const existing = await this.projectRepository.getProjectById(projectId);
    if (!existing) {
      this.logger.warn('Project update rejected: target project not found', { projectId });
      throw new ResourceNotFoundError({
        resourceName: this.projectRepository.resourceName,
      });
    }

    const updated = await this.projectRepository.updateProject(projectId, {
      ...(params.name !== undefined ? { name: params.name } : {}),
      ...(params.description !== undefined ? { description: params.description } : {}),
    });

    this.logger.info('Project updated', { projectId: updated.id, actorId: actor.userId });

    return updated;
  }

  public async deleteProject(actor: ActorContext, projectId: string): Promise<void> {
    this.authorizationGuard.authorize({
      actor,
      scope: AuthorizationScope.Project,
      action: 'deleteProject',
      resource: projectId,
    });

    const existing = await this.projectRepository.getProjectById(projectId);
    if (!existing) {
      this.logger.warn('Project deletion rejected: target project not found', { projectId });
      throw new ResourceNotFoundError({
        resourceName: this.projectRepository.resourceName,
      });
    }

    await this.projectRepository.deleteProject(projectId);

    this.logger.info('Project deleted', { projectId, actorId: actor.userId });
  }
}
