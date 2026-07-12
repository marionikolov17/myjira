import { IRepository } from '@/common/interfaces';
import { User } from './user.schema';
import {
  BulkCreateUsersParams,
  CreateUserParams,
  HasUsersForWorkspaceRoleIdsParams,
} from './user.types';

export interface IUserRepository extends IRepository {
  createUser(params: CreateUserParams): Promise<User>;
  bulkCreateUsers(params: BulkCreateUsersParams): Promise<User[]>;
  hasUsersForWorkspaceRoleIds(params: HasUsersForWorkspaceRoleIdsParams): Promise<boolean>;
  getUserByEmailWithPassword(email: string): Promise<(User & { password: string }) | null>;
  getUserById(userId: string): Promise<User | null>;
}
