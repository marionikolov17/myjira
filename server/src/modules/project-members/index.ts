import { logger } from '@/common/logger';
import { authorizationGuard } from '@/common/authorization';
import { projectRoleRepository } from '@/modules/project-roles';
import { projectRepository } from '@/modules/projects/project.repository';
import { ProjectMemberController } from './project-member.controller';
import { ProjectMemberService } from './project-member.service';
import { projectMemberRepository } from './project-member.repository';

export * from './project-member.schema';
export * from './project-member.interface';
export * from './project-member.types';
export * from './project-member.repository';
export * from './project-member.service';

const projectMemberService = new ProjectMemberService(
  projectMemberRepository,
  projectRoleRepository,
  projectRepository,
  authorizationGuard,
  logger,
);

const projectMemberController = new ProjectMemberController(projectMemberService);

export { projectMemberService, projectMemberController };
