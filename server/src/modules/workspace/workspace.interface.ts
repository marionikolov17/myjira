import { User } from '@/modules/users';
import { BootstrapWorkspaceUsersParams } from './workspace.types';

export interface IWorkspaceService {
  bootstrapWorkspaceUsers(params: BootstrapWorkspaceUsersParams): Promise<User[]>;
}
