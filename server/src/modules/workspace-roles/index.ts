import { authorizationGuard } from '@/common/authorization';
import { workspaceRoleRepository } from './workspace-role.repository';
import { WorkspaceRoleService } from './workspace-role.service';
import { WorkspaceRoleController } from './workspace-role.controller';

export * from './workspace-role.schema';
export * from './workspace-role.interface';
export * from './workspace-role.repository';
export * from './workspace-role.service';

const workspaceRoleService = new WorkspaceRoleService(workspaceRoleRepository, authorizationGuard);
const workspaceRoleController = new WorkspaceRoleController(workspaceRoleService);

export { workspaceRoleController, workspaceRoleService };
