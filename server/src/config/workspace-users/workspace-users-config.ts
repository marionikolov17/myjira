import { WorkspaceRole, WorkspaceRoleName } from '@/modules/workspace-roles';
import { passwordHasher } from '@/common/password-hasher';
import { CreateUserParams } from '@/modules/users';
import { WorkspaceUserConfig } from './workspace-user-config';
import { env } from '../env';

export interface IWorkspaceUsersConfig {
  getUsers(workspaceRoles: WorkspaceRole[]): Promise<CreateUserParams[]>;
}

export class WorkspaceUsersConfig implements IWorkspaceUsersConfig {
  constructor(private readonly users: WorkspaceUserConfig[]) {}

  public async getUsers(workspaceRoles: WorkspaceRole[]): Promise<CreateUserParams[]> {
    return Promise.all(this.users.map((user) => user.getRecord(workspaceRoles)));
  }
}

export const workspaceUsersConfig = new WorkspaceUsersConfig([
  new WorkspaceUserConfig(
    env.ADMIN_EMAIL,
    env.ADMIN_NAME,
    env.ADMIN_PASSWORD,
    WorkspaceRoleName.ADMIN,
    passwordHasher,
  ),
  new WorkspaceUserConfig(
    env.OWNER_EMAIL,
    env.OWNER_NAME,
    env.OWNER_PASSWORD,
    WorkspaceRoleName.OWNER,
    passwordHasher,
  ),
  new WorkspaceUserConfig(
    env.DEVELOPER_EMAIL,
    env.DEVELOPER_NAME,
    env.DEVELOPER_PASSWORD,
    WorkspaceRoleName.DEVELOPER,
    passwordHasher,
  ),
]);
