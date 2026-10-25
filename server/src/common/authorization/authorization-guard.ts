import { AuthorizationError } from '@/common/errors';
import { ProjectRoleName } from '@/modules/project-roles';
import { WorkspaceRoleName } from '@/modules/workspace-roles';
import { AuthorizationMatrix, ProjectActionConfig } from './authorization-matrix';
import { AuthorizationScope, AuthorizeInput } from './authorization.types';
import { IAuthorizationGuard } from './authorization-guard.interface';

interface NormalizedProjectActionConfig {
  projectRoles: ProjectRoleName[];
  workspaceBypass: WorkspaceRoleName[];
}

function normalizeProjectActionConfig(config: ProjectActionConfig): NormalizedProjectActionConfig {
  if (Array.isArray(config)) {
    return { projectRoles: config, workspaceBypass: [] };
  }
  return {
    projectRoles: config.projectRoles,
    workspaceBypass: config.workspaceBypass ?? [],
  };
}

export class AuthorizationGuard implements IAuthorizationGuard {
  constructor(private readonly matrix: AuthorizationMatrix) {}

  public authorize(input: AuthorizeInput): void {
    switch (input.scope) {
      case AuthorizationScope.Workspace:
        return this.authorizeWorkspace(input);
      case AuthorizationScope.Project:
        return this.authorizeProject(input);
      default:
        throw new AuthorizationError();
    }
  }

  private authorizeWorkspace(
    input: Extract<AuthorizeInput, { scope: AuthorizationScope.Workspace }>,
  ): void {
    const allowedRoles = this.matrix[AuthorizationScope.Workspace][input.action];

    if (!allowedRoles || !allowedRoles.includes(input.actor.workspaceRole.name)) {
      throw new AuthorizationError();
    }
  }

  private authorizeProject(
    input: Extract<AuthorizeInput, { scope: AuthorizationScope.Project }>,
  ): void {
    const entry = this.matrix[AuthorizationScope.Project][input.action];
    if (!entry) {
      throw new AuthorizationError();
    }

    if (!input.resource) {
      throw new AuthorizationError();
    }

    const { projectRoles, workspaceBypass } = normalizeProjectActionConfig(entry);

    if (workspaceBypass.includes(input.actor.workspaceRole.name)) {
      return;
    }

    const projectRole = input.actor.projectRoles.find((role) => role.projectId === input.resource);

    if (!projectRole || !projectRoles.includes(projectRole.projectRoleName)) {
      throw new AuthorizationError();
    }
  }
}
