import { WorkspaceService } from './workspace.service';
import { WorkspaceController } from './workspace.controller';
import { userRepository } from '@/modules/users';
import { workspaceRoleRepository } from '@/modules/workspace-roles';
import { passwordHasher } from '@/common/password-hasher';
import { logger } from '@/common/logger';

const workspaceService = new WorkspaceService(
  userRepository,
  workspaceRoleRepository,
  passwordHasher,
  logger,
);
const workspaceController = new WorkspaceController(workspaceService);

export { workspaceController };
