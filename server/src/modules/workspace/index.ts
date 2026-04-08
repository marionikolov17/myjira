import { userRepository } from '@/modules/users';
import { workspaceRoleRepository } from '@/modules/workspace-roles';
import { workspaceUsersConfig } from '@/config/workspace-users/workspace-users-config';
import { logger } from '@/common/logger';
import { env } from '@/config/env';
import { WorkspaceService } from './workspace.service';
import { WorkspaceController } from './workspace.controller';
import { BootstrapWorkspaceConfigParams } from './workspace.types';

const bootstrapWorkspaceConfig: BootstrapWorkspaceConfigParams = {
  bootstrapToken: env.BOOTSTRAP_TOKEN,
};

const workspaceService = new WorkspaceService(
  userRepository,
  workspaceRoleRepository,
  workspaceUsersConfig,
  logger,
  bootstrapWorkspaceConfig,
);
const workspaceController = new WorkspaceController(workspaceService);

export { workspaceController };
