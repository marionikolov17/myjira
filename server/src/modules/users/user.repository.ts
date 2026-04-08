import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/common/supabase';
import { ILogger, logger } from '@/common/logger';
import { mapSupabaseError } from '@/common/utils/map-supabase-error';
import { BulkCreateUsersParams, CreateUserParams } from './user.types';
import { User, UserSchema } from './user.schema';
import { IUserRepository } from './user.interface';

export class UserRepository implements IUserRepository {
  private readonly tableName: string = 'users';
  private readonly selectColumns: string =
    'id, name, email, workspace_role_id, created_at, updated_at';
  public readonly resourceName: string = 'users';

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly logger: ILogger,
  ) {}

  public async createUser(params: CreateUserParams): Promise<User> {
    const { data: user, error } = await this.supabase
      .from(this.tableName)
      .insert({
        name: params.name,
        email: params.email,
        password: params.hashedPassword,
        workspace_role_id: params.workspaceRoleId,
      })
      .select(this.selectColumns)
      .single();

    if (error) {
      this.logger.error(error.message, { cause: error.cause, stack: error.stack });
      throw mapSupabaseError(error);
    }

    return UserSchema.parse(user);
  }

  public async bulkCreateUsers(params: BulkCreateUsersParams): Promise<User[]> {
    const { data: users, error } = await this.supabase
      .from(this.tableName)
      .insert(
        params.users.map((user) => ({
          name: user.name,
          email: user.email,
          password: user.hashedPassword,
          workspace_role_id: user.workspaceRoleId,
        })),
      )
      .select(this.selectColumns);

    if (error) {
      this.logger.error(error.message, { cause: error.cause, stack: error.stack });
      throw mapSupabaseError(error);
    }

    return users.map((user) => UserSchema.parse(user));
  }
}

export const userRepository = new UserRepository(supabase, logger);
