import { IAuthorizationGuard } from '@/common/authorization';
import { ActorContext } from '@/common/interfaces';
import { AuthorizationScope } from '@/common/authorization';
import { IWorkspaceRoleRepository } from './workspace-role.interface';
import { WorkspaceRole } from './workspace-role.schema';

export interface IWorkspaceRoleService {
  listWorkspaceRoles(actor: ActorContext): Promise<WorkspaceRole[]>;
}

export class WorkspaceRoleService implements IWorkspaceRoleService {
  constructor(
    private readonly workspaceRoleRepository: IWorkspaceRoleRepository,
    private readonly authorizationGuard: IAuthorizationGuard,
  ) {}

  public async listWorkspaceRoles(actor: ActorContext): Promise<WorkspaceRole[]> {
    this.authorizationGuard.authorize({
      actor,
      scope: AuthorizationScope.Workspace,
      action: 'listWorkspaceRoles',
    });

    return this.workspaceRoleRepository.getWorkspaceRoles();
  }
}
