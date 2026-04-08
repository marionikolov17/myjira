import { env } from '@/config/env';
import { CreateUserParams, IUserRepository } from '@/modules/users';
import {
  IWorkspaceRoleRepository,
  WorkspaceRole,
  WorkspaceRoleName,
} from '@/modules/workspace-roles';
import { AuthorizationError, ResourceNotFoundError } from '@/common/errors';
import { IPasswordHasher } from '@/common/password-hasher';
import { BootstrapWorkspaceUsersParams } from './workspace.types';
import { IWorkspaceService } from './workspace.interface';
import { ILogger } from '@/common/logger';

export class WorkspaceService implements IWorkspaceService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly workspaceRoleRepository: IWorkspaceRoleRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly logger: ILogger,
  ) {}

  public async bootstrapWorkspaceUsers(params: BootstrapWorkspaceUsersParams) {
    this.validateBootstrapToken(params.bootstrapToken);

    const workspaceRoles = await this.getWorkspaceRoles();

    const usersConfig = await this.createWorkspaceUsersConfig(workspaceRoles);
    const users = await this.userRepository.bulkCreateUsers({ users: usersConfig });

    this.logger.info('Workspace users created');

    return users;
  }

  private validateBootstrapToken(bootstrapToken: string) {
    if (bootstrapToken !== env.BOOTSTRAP_TOKEN) {
      this.logger.error('Invalid Bootstrap Token');
      throw new AuthorizationError();
    }
  }

  private async getWorkspaceRoles() {
    const workspaceRoles = await this.workspaceRoleRepository.getWorkspaceRoles();

    this.validateWorkspaceRoles(workspaceRoles);

    return workspaceRoles;
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

  private async createWorkspaceUsersConfig(workspaceRoles: WorkspaceRole[]) {
    const usersConfig: CreateUserParams[] = [
      {
        email: env.ADMIN_EMAIL,
        name: env.ADMIN_NAME,
        hashedPassword: await this.passwordHasher.hashPassword(env.ADMIN_PASSWORD),
        workspaceRoleId: workspaceRoles.find((role) => role.name === WorkspaceRoleName.ADMIN)
          ?.id as string,
      },
      {
        email: env.OWNER_EMAIL,
        name: env.OWNER_NAME,
        hashedPassword: await this.passwordHasher.hashPassword(env.OWNER_PASSWORD),
        workspaceRoleId: workspaceRoles.find((role) => role.name === WorkspaceRoleName.OWNER)
          ?.id as string,
      },
      {
        email: env.DEVELOPER_EMAIL,
        name: env.DEVELOPER_NAME,
        hashedPassword: await this.passwordHasher.hashPassword(env.DEVELOPER_PASSWORD),
        workspaceRoleId: workspaceRoles.find((role) => role.name === WorkspaceRoleName.DEVELOPER)
          ?.id as string,
      },
    ];

    return usersConfig;
  }
}
