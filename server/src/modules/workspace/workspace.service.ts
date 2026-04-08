import { IUserRepository } from '@/modules/users';
import {
  IWorkspaceRoleRepository,
  WorkspaceRole,
  WorkspaceRoleName,
} from '@/modules/workspace-roles';
import { AuthorizationError, ResourceNotFoundError } from '@/common/errors';
import { ILogger } from '@/common/logger';
import { IWorkspaceUsersConfig } from '@/config/workspace-users/workspace-users-config';
import { BootstrapWorkspaceConfigParams, BootstrapWorkspaceUsersParams } from './workspace.types';
import { IWorkspaceService } from './workspace.interface';

export class WorkspaceService implements IWorkspaceService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly workspaceRoleRepository: IWorkspaceRoleRepository,
    private readonly workspaceUsersConfig: IWorkspaceUsersConfig,
    private readonly logger: ILogger,
    private readonly bootstrapWorkspaceConfig: BootstrapWorkspaceConfigParams,
  ) {}

  public async bootstrapWorkspaceUsers(params: BootstrapWorkspaceUsersParams) {
    this.validateBootstrapToken(params.bootstrapToken);

    const workspaceRoles = await this.workspaceRoleRepository.getWorkspaceRoles();

    this.validateWorkspaceRoles(workspaceRoles);

    const usersConfig = await this.workspaceUsersConfig.getUsers(workspaceRoles);
    const users = await this.userRepository.bulkCreateUsers({ users: usersConfig });

    this.logger.info('Workspace users created');

    return users;
  }

  private validateBootstrapToken(bootstrapToken: string) {
    if (bootstrapToken !== this.bootstrapWorkspaceConfig.bootstrapToken) {
      this.logger.error('Invalid Bootstrap Token');
      throw new AuthorizationError();
    }
  }

  private validateWorkspaceRoles(workspaceRoles: WorkspaceRole[]) {
    for (const role of Object.values(WorkspaceRoleName)) {
      if (!workspaceRoles.some((r) => r.name === role)) {
        this.logger.error(`Workspace role ${role} not found`);
        throw new ResourceNotFoundError({
          resourceName: this.workspaceRoleRepository.resourceName,
        });
      }
    }
  }
}
