import { logger } from '@/common/logger';
import { authorizationGuard } from '@/common/authorization';
import { queryParser } from '@/common/query';
import { unitOfWork } from '@/common/unit-of-work';
import { projectMemberRepository } from '@/modules/project-members';
import { projectRoleRepository } from '@/modules/project-roles';
import { ProjectsController } from './project.controller';
import { ProjectService } from './project.service';
import { projectRepository } from './project.repository';
import { projectsQueryConfig } from './project.query-config';

export * from './project.schema';
export * from './project.interface';
export * from './project.types';
export * from './project.query-config';
export * from './project.repository';
export * from './project.service';

const projectService = new ProjectService(
  projectRepository,
  projectMemberRepository,
  projectRoleRepository,
  authorizationGuard,
  unitOfWork,
  logger,
);

const projectsController = new ProjectsController(projectService, queryParser, projectsQueryConfig);

export { projectsController, projectService };
