import { authorizationGuard } from '@/common/authorization';
import { projectRoleRepository } from './project-role.repository';
import { ProjectRoleService } from './project-role.service';
import { ProjectRoleController } from './project-role.controller';

export * from './project-role.schema';
export * from './project-role.interface';
export * from './project-role.repository';
export * from './project-role.service';

const projectRoleService = new ProjectRoleService(projectRoleRepository, authorizationGuard);
const projectRoleController = new ProjectRoleController(projectRoleService);

export { projectRoleController, projectRoleService };
