import { ActorContext, IRepository } from '@/common/interfaces';
import { UserStatus } from '@/generated/prisma/enums';
import { CreatedUser, User } from './user.schema';
import {
  BulkCreateUsersParams,
  CreateUserParams,
  CreateUserResult,
  HasUsersForWorkspaceRoleIdsParams,
} from './user.types';
import { CreateUserRequestParams } from './user.schema';

export interface IUserRepository extends IRepository {
  createUser(params: CreateUserParams): Promise<CreatedUser>;
  bulkCreateUsers(params: BulkCreateUsersParams): Promise<User[]>;
  hasUsersForWorkspaceRoleIds(params: HasUsersForWorkspaceRoleIdsParams): Promise<boolean>;
  getUserByEmailWithPassword(
    email: string,
  ): Promise<(User & { password: string | null; status: UserStatus }) | null>;
  getUserById(userId: string): Promise<User | null>;
}

export interface IUserService {
  createUser(actor: ActorContext, params: CreateUserRequestParams): Promise<CreateUserResult>;
}
