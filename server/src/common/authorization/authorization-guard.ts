import { AuthorizationError } from '@/common/errors';
import { AuthorizationMatrix } from './authorization-matrix';
import { AuthorizationScope, AuthorizeInput } from './authorization.types';
import { IAuthorizationGuard } from './authorization-guard.interface';

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
    const allowedRoles = this.matrix[AuthorizationScope.Project][input.action];
    if (!allowedRoles) {
      throw new AuthorizationError();
    }

    if (!input.resource) {
      throw new AuthorizationError();
    }

    const projectRole = input.actor.projectRoles.find((role) => role.projectId === input.resource);

    if (!projectRole || !allowedRoles.includes(projectRole.projectRoleName)) {
      throw new AuthorizationError();
    }
  }
}
