import { IRepository } from '@/common/interfaces';
import { WorkspaceRole } from './workspace-role.schema';

export interface IWorkspaceRoleRepository extends IRepository {
  getWorkspaceRoles(): Promise<WorkspaceRole[]>;
}
