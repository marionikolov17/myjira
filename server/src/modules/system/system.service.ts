import { env } from '@/config/env';
import { CreateUserParams, IUserRepository } from '@/modules/users';
import {
  IWorkspaceRoleRepository,
  WorkspaceRole,
  WorkspaceRoleName,
} from '@/modules/workspace-roles';
import { AuthorizationError, ResourceNotFoundError } from '@/common/errors';
import { IPasswordHasher } from '@/common/password-hasher';
import { BootstrapSystemUsersParams } from './system.types';
import { ISystemService } from './system.interface';

export class SystemService implements ISystemService {
  private readonly userRepository: IUserRepository;
  private readonly workspaceRoleRepository: IWorkspaceRoleRepository;
  private readonly passwordHasher: IPasswordHasher;

  constructor(
    userRepository: IUserRepository,
    workspaceRoleRepository: IWorkspaceRoleRepository,
    passwordHasher: IPasswordHasher,
  ) {
    this.userRepository = userRepository;
    this.workspaceRoleRepository = workspaceRoleRepository;
    this.passwordHasher = passwordHasher;
  }

  public async bootstrapSystemUsers(params: BootstrapSystemUsersParams) {
    this.validateBootstrapToken(params.bootstrapToken);

    const workspaceRoles = await this.getWorkspaceRoles();

    const usersConfig = await this.createSystemUsersConfig(workspaceRoles);
    return this.userRepository.bulkUpsertUsers({ users: usersConfig });
  }

  private validateBootstrapToken(bootstrapToken: string) {
    if (bootstrapToken !== env.BOOTSTRAP_TOKEN) {
      throw new AuthorizationError();
    }
  }

  private async getWorkspaceRoles() {
    const workspaceRoles = await this.workspaceRoleRepository.getWorkspaceRoles();

    if (!workspaceRoles.length) {
      throw new ResourceNotFoundError({ resourceName: this.workspaceRoleRepository.resourceName });
    }

    return workspaceRoles;
  }

  private async createSystemUsersConfig(workspaceRoles: WorkspaceRole[]) {
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
