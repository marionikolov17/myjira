import { env } from '@/config/env';
import { CreateUserParams, IUserRepository } from '@/modules/users';
import { IWorkspaceRoleRepository, WorkspaceRole } from '@/modules/workspace-roles';
import { AuthorizationError, ResourceNotFoundError } from '@/common/errors';
import { IPasswordHasher } from '@/common/password-hasher';
import { BootstrapSystemUsersParams } from './system.types';

export class SystemService {
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
    const usersConfig: CreateUserParams[] = [];

    for (const role of workspaceRoles) {
      usersConfig.push({
        email: env[`${role.name.toUpperCase()}_EMAIL` as keyof typeof env] as string,
        name: env[`${role.name.toUpperCase()}_NAME` as keyof typeof env] as string,
        hashedPassword: await this.passwordHasher.hashPassword(
          env[`${role.name.toUpperCase()}_PASSWORD` as keyof typeof env] as string,
        ),
        workspaceRoleId: role.id,
      });
    }

    return usersConfig;
  }
}
