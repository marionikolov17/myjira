import { User } from '@/modules/users';
import { BootstrapWorkspaceUsersParams } from './workspace.schema';

export interface IWorkspaceService {
  bootstrapWorkspaceUsers(params: BootstrapWorkspaceUsersParams): Promise<User[]>;
}
