import { WorkspaceRole } from './workspace-role.schema';

export interface IWorkspaceRoleRepository {
  getWorkspaceRoles(): Promise<WorkspaceRole[]>;
}
