import { ILogger, logger } from '@/common/logger';
import { supabase } from '@/common/supabase';
import { SupabaseClient } from '@supabase/supabase-js';
import { WorkspaceRole, WorkspaceRoleSchema } from './workspace-role.schema';
import { IWorkspaceRoleRepository } from './workspace-role.interface';

export class WorkspaceRoleRepository implements IWorkspaceRoleRepository {
  private readonly supabase: SupabaseClient;
  private readonly logger: ILogger;
  private readonly tableName: string = 'workspace_roles';
  private readonly selectColumns: string = 'id, name, created_at, updated_at';
  public readonly resourceName: string = 'workspace_roles';

  constructor(supabase: SupabaseClient, logger: ILogger) {
    this.supabase = supabase;
    this.logger = logger;
  }

  public async getWorkspaceRoles(): Promise<WorkspaceRole[]> {
    const { data: roles, error } = await this.supabase
      .from(this.tableName)
      .select(this.selectColumns);

    if (error) {
      this.logger.error(error.message, { cause: error.cause, stack: error.stack });
      throw new Error(error.message, { cause: error.cause });
    }

    return roles.map((row) => WorkspaceRoleSchema.parse(row));
  }
}

export const workspaceRoleRepository = new WorkspaceRoleRepository(supabase, logger);
