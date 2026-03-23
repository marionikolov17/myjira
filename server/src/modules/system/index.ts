import { SystemService } from './system.service';
import { SystemController } from './system.controller';
import { userRepository } from '../users/user.repository';
import { workspaceRoleRepository } from '../workspace-roles/workspace-role.repository';
import { passwordHasher } from '@/common/password-hasher';

const systemService = new SystemService(userRepository, workspaceRoleRepository, passwordHasher);
const systemController = new SystemController(systemService);

export { systemController };
