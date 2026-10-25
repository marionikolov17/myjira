import { ActorContext } from '@/common/interfaces';
import { ILogger } from '@/common/logger';
import { BusinessRuleViolationError, ResourceNotFoundError } from '@/common/errors';
import { AuthorizationScope, IAuthorizationGuard } from '@/common/authorization';
import { IProjectRepository } from '@/modules/projects/project.interface';
import { IProjectRoleRepository, ProjectRoleName } from '@/modules/project-roles';
import { WorkspaceRoleName } from '@/modules/workspace-roles';
import { IProjectMemberRepository, IProjectMemberService } from './project-member.interface';
import { ProjectMemberExpanded } from './project-member.schema';
import { AddProjectMemberParams, UpdateProjectMemberRoleParams } from './project-member.types';

export class ProjectMemberService implements IProjectMemberService {
  constructor(
    private readonly projectMemberRepository: IProjectMemberRepository,
    private readonly projectRoleRepository: IProjectRoleRepository,
    private readonly projectRepository: IProjectRepository,
    private readonly authorizationGuard: IAuthorizationGuard,
    private readonly logger: ILogger,
  ) {}

  /**
   * Resolves the request's `projectRoleId` into a project role, rejecting with
   * 422 when the id does not resolve or when it resolves to the Project Owner
   * role (never assignable through add/update endpoints).
   */
  private async resolveAssignableRole(
    projectRoleId: string,
  ): Promise<{ id: string; name: ProjectRoleName }> {
    const role = await this.projectRoleRepository.getProjectRoleById(projectRoleId);

    if (!role) {
      this.logger.warn('Project-member write rejected: unknown projectRoleId', {
        projectRoleId,
      });
      throw new BusinessRuleViolationError('The specified project role does not exist');
    }

    if (role.name === ProjectRoleName.PROJECT_OWNER) {
      this.logger.warn('Project-member write rejected: Project Owner role is not assignable', {
        projectRoleId,
      });
      throw new BusinessRuleViolationError(
        'The Project Owner role cannot be assigned through this endpoint',
      );
    }

    return { id: role.id, name: role.name };
  }

  /**
   * Target-role ladder: a Project Admin actor may only add or remove members
   * whose target project role is Developer. The ladder runs only when the
   * actor's project role on the target project is Project Admin. Workspace
   * Owners always skip it (they authorize via workspace bypass and act as
   * effective Project Owner), matching D1.
   */
  private assertCanActOnTarget(
    actor: ActorContext,
    projectId: string,
    targetRole: ProjectRoleName,
    operation: 'add' | 'remove',
  ): void {
    if (actor.workspaceRole.name === WorkspaceRoleName.OWNER) {
      // Workspace Owners skip the ladder, matching D1.
      return;
    }

    const actorProjectRole = actor.projectRoles.find((role) => role.projectId === projectId);

    if (
      actorProjectRole?.projectRoleName === ProjectRoleName.PROJECT_ADMIN &&
      targetRole !== ProjectRoleName.DEVELOPER
    ) {
      this.logger.warn(
        'Project-member write rejected: Project Admin may only act on Developer-tier targets',
        { actorId: actor.userId, projectId, targetRole, operation },
      );
      throw new BusinessRuleViolationError(
        operation === 'add'
          ? 'A Project Admin may only add Developer-tier members'
          : 'A Project Admin may only remove Developer-tier members',
      );
    }
  }

  public async addProjectMember(
    actor: ActorContext,
    projectId: string,
    params: AddProjectMemberParams,
  ): Promise<ProjectMemberExpanded> {
    this.authorizationGuard.authorize({
      actor,
      scope: AuthorizationScope.Project,
      action: 'addProjectMember',
      resource: projectId,
    });

    const project = await this.projectRepository.getProjectById(projectId);
    if (!project) {
      this.logger.warn('Project-member addition rejected: target project not found', {
        projectId,
      });
      throw new ResourceNotFoundError({
        resourceName: this.projectRepository.resourceName,
      });
    }

    const role = await this.resolveAssignableRole(params.projectRoleId);

    this.assertCanActOnTarget(actor, projectId, role.name, 'add');

    const member = await this.projectMemberRepository.createProjectMember({
      projectId,
      userId: params.userId,
      projectRoleId: role.id,
    });

    this.logger.info('Project member added', {
      memberId: member.id,
      projectId,
      actorId: actor.userId,
    });

    return member;
  }

  public async listProjectMembers(
    actor: ActorContext,
    projectId: string,
  ): Promise<ProjectMemberExpanded[]> {
    this.authorizationGuard.authorize({
      actor,
      scope: AuthorizationScope.Project,
      action: 'listProjectMembers',
      resource: projectId,
    });

    const project = await this.projectRepository.getProjectById(projectId);
    if (!project) {
      this.logger.warn('Project-member listing rejected: target project not found', { projectId });
      throw new ResourceNotFoundError({
        resourceName: this.projectRepository.resourceName,
      });
    }

    return this.projectMemberRepository.listProjectMembers(projectId);
  }

  public async updateProjectMemberRole(
    actor: ActorContext,
    projectId: string,
    memberId: string,
    params: UpdateProjectMemberRoleParams,
  ): Promise<ProjectMemberExpanded> {
    this.authorizationGuard.authorize({
      actor,
      scope: AuthorizationScope.Project,
      action: 'updateProjectMemberRole',
      resource: projectId,
    });

    const target = await this.projectMemberRepository.getProjectMemberById(memberId, projectId);
    if (!target) {
      this.logger.warn('Project-member role update rejected: target member not found', {
        memberId,
        projectId,
      });
      throw new ResourceNotFoundError({
        resourceName: this.projectMemberRepository.resourceName,
      });
    }

    if (target.projectRole.name === ProjectRoleName.PROJECT_OWNER) {
      this.logger.warn(
        'Project-member role update rejected: Project Owner member role cannot be changed',
        { memberId, projectId },
      );
      throw new BusinessRuleViolationError("The Project Owner member's role cannot be changed");
    }

    if (target.user.id === actor.userId) {
      this.logger.warn('Project-member role update rejected: actor cannot modify self', {
        memberId,
        actorId: actor.userId,
      });
      throw new BusinessRuleViolationError('Actor cannot modify their own project membership');
    }

    const role = await this.resolveAssignableRole(params.projectRoleId);

    const updated = await this.projectMemberRepository.updateProjectMemberRole(memberId, role.id);

    this.logger.info('Project member role updated', {
      memberId,
      projectId,
      actorId: actor.userId,
      from: target.projectRole.name,
      to: role.name,
    });

    return updated;
  }

  public async removeProjectMember(
    actor: ActorContext,
    projectId: string,
    memberId: string,
  ): Promise<void> {
    this.authorizationGuard.authorize({
      actor,
      scope: AuthorizationScope.Project,
      action: 'removeProjectMember',
      resource: projectId,
    });

    const target = await this.projectMemberRepository.getProjectMemberById(memberId, projectId);
    if (!target) {
      this.logger.warn('Project-member removal rejected: target member not found', {
        memberId,
        projectId,
      });
      throw new ResourceNotFoundError({
        resourceName: this.projectMemberRepository.resourceName,
      });
    }

    if (target.projectRole.name === ProjectRoleName.PROJECT_OWNER) {
      this.logger.warn('Project-member removal rejected: Project Owner cannot be removed', {
        memberId,
        projectId,
      });
      throw new BusinessRuleViolationError('The Project Owner cannot be removed');
    }

    if (target.user.id === actor.userId) {
      this.logger.warn('Project-member removal rejected: actor cannot remove self', {
        memberId,
        actorId: actor.userId,
      });
      throw new BusinessRuleViolationError('Actor cannot modify their own project membership');
    }

    this.assertCanActOnTarget(actor, projectId, target.projectRole.name, 'remove');

    await this.projectMemberRepository.deleteProjectMember(memberId);

    this.logger.info('Project member removed', { memberId, projectId, actorId: actor.userId });
  }
}
