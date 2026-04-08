import { WorkspaceRole, WorkspaceRoleName } from '@/modules/workspace-roles';
import { IPasswordHasher } from '@/common/password-hasher';
import { CreateUserParams } from '@/modules/users';

export class WorkspaceUserConfig {
  constructor(
    private readonly email: string,
    private readonly name: string,
    private readonly password: string,
    private readonly workspaceRoleName: WorkspaceRoleName,
    private readonly passwordHasher: IPasswordHasher,
  ) {}

  public async getRecord(workspaceRoles: WorkspaceRole[]): Promise<CreateUserParams> {
    const workspaceRole = workspaceRoles.find((role) => role.name === this.workspaceRoleName);

    return {
      email: this.email,
      name: this.name,
      hashedPassword: await this.passwordHasher.hashPassword(this.password),
      workspaceRoleId: workspaceRole?.id ?? '',
    };
  }
}
