import express from 'express';
import { createTestSupabaseClient } from '../../../lib/supabase-client';
import { getTestSchema } from '../../../lib/schema-manager';
import { UserRepository } from '@/modules/users/user.repository';
import { logger } from '@/common/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { WorkspaceRoleRepository } from '@/modules/workspace-roles/workspace-role.repository';
import { passwordHasher } from '@/common/password-hasher';
import { WorkspaceService } from '@/modules/workspace/workspace.service';
import { WorkspaceController } from '@/modules/workspace/workspace.controller';

const schema = getTestSchema();
const testSupabase = createTestSupabaseClient(schema);
const userRepository = new UserRepository(testSupabase as unknown as SupabaseClient, logger);
const workspaceRoleRepository = new WorkspaceRoleRepository(
  testSupabase as unknown as SupabaseClient,
  logger,
);
const workspaceService = new WorkspaceService(
  userRepository,
  workspaceRoleRepository,
  passwordHasher,
  logger,
);
const workspaceController = new WorkspaceController(workspaceService);

const app = express();
app.use(express.json());
app.use('/', workspaceController.router);
export { app };
