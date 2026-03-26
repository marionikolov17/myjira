import { WorkspaceService } from './workspace.service';
import { WorkspaceController } from './workspace.controller';
import { userRepository } from '../users/user.repository';
import { workspaceRoleRepository } from '../workspace-roles/workspace-role.repository';
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
