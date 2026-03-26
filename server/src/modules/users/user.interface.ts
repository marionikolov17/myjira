import { IRepository } from '@/common/interfaces';
import { User } from './user.schema';
import { BulkCreateUsersParams, CreateUserParams } from './user.types';

export interface IUserRepository extends IRepository {
  createUser(params: CreateUserParams): Promise<User>;
  bulkCreateUsers(params: BulkCreateUsersParams): Promise<User[]>;
}
