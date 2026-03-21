import { IRepository } from '@/common/interfaces';
import { User } from './user.schema';
import { BulkUpsertUsersParams, CreateUserParams } from './user.types';

export interface IUserRepository extends IRepository {
  createUser(params: CreateUserParams): Promise<User>;
  bulkUpsertUsers(params: BulkUpsertUsersParams): Promise<User[]>;
}
