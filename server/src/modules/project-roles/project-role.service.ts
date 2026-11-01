import { IAuthorizationGuard } from '@/common/authorization';
import { ActorContext } from '@/common/interfaces';
import { AuthorizationScope } from '@/common/authorization';
import { IProjectRoleRepository } from './project-role.interface';
import { ProjectRole } from './project-role.schema';

export interface IProjectRoleService {
  listProjectRoles(actor: ActorContext): Promise<ProjectRole[]>;
}

export class ProjectRoleService implements IProjectRoleService {
  constructor(
    private readonly projectRoleRepository: IProjectRoleRepository,
    private readonly authorizationGuard: IAuthorizationGuard,
  ) {}

  public async listProjectRoles(actor: ActorContext): Promise<ProjectRole[]> {
    this.authorizationGuard.authorize({
      actor,
      scope: AuthorizationScope.Workspace,
      action: 'listProjectRoles',
    });

    return this.projectRoleRepository.getProjectRoles();
  }
}
