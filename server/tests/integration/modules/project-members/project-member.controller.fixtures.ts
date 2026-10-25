import express, { Application } from 'express';

import { errorMiddleware, createAuthenticationMiddleware } from '@/common/middlewares';
import { prisma } from '@/common/lib/prisma';
import { JsonwebtokenTokenService } from '@/common/token-service/jsonwebtoken-token-service';
import { ITokenService } from '@/common/token-service/token-service.interface';
import { authorizationGuard } from '@/common/authorization';

import { IUserRepository, UserRepository } from '@/modules/users';
import { IWorkspaceRoleRepository, WorkspaceRoleRepository } from '@/modules/workspace-roles';
import { IProjectMemberRepository, ProjectMemberRepository } from '@/modules/project-members';
import { ProjectMemberController } from '@/modules/project-members/project-member.controller';
import { ProjectMemberService } from '@/modules/project-members/project-member.service';
import { IProjectRoleRepository, ProjectRoleRepository } from '@/modules/project-roles';
import { ActorContextService } from '@/modules/auth/actor-context.service';
import { IProjectRepository, ProjectRepository } from '@/modules/projects';

import { silentLogger } from '../../fixtures/logger.fixtures';
import { buildTestUsers } from '../../fixtures/actor-context.fixtures';

export const SECRET_KEY = 'project-members-test-secret-key';
export const WRONG_SECRET_KEY = 'project-members-test-wrong-secret-key';
export const TOKEN_EXPIRES_IN_SECONDS = 3600;

export const testUsers = buildTestUsers('project-members-');

export interface ProjectMembersTestContext {
  app: Application;
  tokenService: ITokenService;
  projectRepository: IProjectRepository;
  projectMemberRepository: IProjectMemberRepository;
  projectRoleRepository: IProjectRoleRepository;
  userRepository: IUserRepository;
  workspaceRoleRepository: IWorkspaceRoleRepository;
}

/**
 * Builds a project-members test app whose request pipeline mirrors production:
 * the global passive authentication middleware runs before the member router,
 * which guards every route with require-authentication. The member router is
 * mounted with `mergeParams: true` so it sees `req.params.projectId`.
 *
 * NB! The exposed repositories and token service are the SAME instances
 * injected into the authentication middleware and the project-member service.
 * Spy on them to inject failures.
 */
export function createProjectMembersTestContext(): ProjectMembersTestContext {
  const userRepository = new UserRepository(prisma, silentLogger);
  const workspaceRoleRepository = new WorkspaceRoleRepository(prisma, silentLogger);
  const projectMemberRepository = new ProjectMemberRepository(prisma, silentLogger);
  const projectRoleRepository = new ProjectRoleRepository(prisma, silentLogger);
  const projectRepository = new ProjectRepository(prisma, silentLogger);

  const tokenService = JsonwebtokenTokenService.create({
    secretKey: SECRET_KEY,
    expiresIn: TOKEN_EXPIRES_IN_SECONDS,
  });

  const actorContextService = new ActorContextService(
    userRepository,
    workspaceRoleRepository,
    projectMemberRepository,
    silentLogger,
  );

  const authenticationMiddleware = createAuthenticationMiddleware({
    tokenService,
    actorContextService,
  });

  const projectMemberService = new ProjectMemberService(
    projectMemberRepository,
    projectRoleRepository,
    projectRepository,
    authorizationGuard,
    silentLogger,
  );

  const projectMemberController = new ProjectMemberController(projectMemberService);

  const app = express();
  app.set('query parser', 'extended');
  app.use(express.json());
  app.use(authenticationMiddleware);
  app.use('/api/v1/projects/:projectId/members', projectMemberController.router);
  app.use(errorMiddleware);

  return {
    app,
    tokenService,
    projectRepository,
    projectMemberRepository,
    projectRoleRepository,
    userRepository,
    workspaceRoleRepository,
  };
}
