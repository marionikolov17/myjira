import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/common/supabase';
import { CreateUserParams } from './user.types';
import { User, UserSchema } from './user.schema';
import { ILogger, logger } from '@/common/logger';
import { IUserRepository } from './user.interface';

export class UserRepository implements IUserRepository {
  private readonly supabase: SupabaseClient;
  private readonly logger: ILogger;
  private readonly tableName: string = 'users';
  private readonly selectColumns: string =
    'id, name, email, workspace_role_id, created_at, updated_at';

  constructor(supabase: SupabaseClient, logger: ILogger) {
    this.supabase = supabase;
    this.logger = logger;
  }

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
      throw new Error(error.message, { cause: error.cause });
    }

    return UserSchema.parse(user);
  }
}

export const userRepository = new UserRepository(supabase, logger);
