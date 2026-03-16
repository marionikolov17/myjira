import { User } from './user.schema';
import { CreateUserParams } from './user.types';

export interface IUserRepository {
  createUser(params: CreateUserParams): Promise<User>;
}
