import { ActorContext, IRepository } from '@/common/interfaces';
import { QueryOptions } from '@/common/query';
import { User } from './user.schema';
import {
  BulkCreateUsersParams,
  CreateUserParams,
  CreateUserResult,
  HasUsersForWorkspaceRoleIdsParams,
  ListUsersResult,
} from './user.types';
import { CreateUserRequestParams } from './user.schema';

export interface IUserRepository extends IRepository {
  createUser(params: CreateUserParams): Promise<User>;
  bulkCreateUsers(params: BulkCreateUsersParams): Promise<User[]>;
  hasUsersForWorkspaceRoleIds(params: HasUsersForWorkspaceRoleIdsParams): Promise<boolean>;
  getUserByEmailWithPassword(email: string): Promise<(User & { password: string | null }) | null>;
  getUserById(userId: string): Promise<User | null>;
  findUsers(options: QueryOptions): Promise<ListUsersResult>;
}

export interface IUserService {
  createUser(actor: ActorContext, params: CreateUserRequestParams): Promise<CreateUserResult>;
  listUsers(actor: ActorContext, options: QueryOptions): Promise<ListUsersResult>;
}
