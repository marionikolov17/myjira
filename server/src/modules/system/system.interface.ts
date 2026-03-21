import { User } from '@/modules/users';
import { BootstrapSystemUsersParams } from './system.types';

export interface ISystemService {
  bootstrapSystemUsers(params: BootstrapSystemUsersParams): Promise<User[]>;
}
