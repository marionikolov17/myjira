import express, { Application } from 'express';

import { errorMiddleware, createAuthenticationMiddleware } from '@/common/middlewares';
import { prisma } from '@/common/lib/prisma';
import { JsonwebtokenTokenService } from '@/common/token-service/jsonwebtoken-token-service';
import { ITokenService } from '@/common/token-service/token-service.interface';
import { authorizationGuard } from '@/common/authorization';
import { queryParser } from '@/common/query';
import { PrismaUnitOfWork, IUnitOfWork } from '@/common/unit-of-work';

import { IUserRepository, UserRepository } from '@/modules/users';
import { IWorkspaceRoleRepository, WorkspaceRoleRepository } from '@/modules/workspace-roles';
import {
  IProjectMemberRepository,
  ProjectMemberRepository,
  ProjectRoleName,
} from '@/modules/project-members';
import { ActorContextService } from '@/modules/auth/actor-context.service';
import { IProjectRepository, ProjectRepository } from '@/modules/projects';
import { ProjectService } from '@/modules/projects';
import { ProjectsController } from '@/modules/projects/project.controller';
import { projectsQueryConfig } from '@/modules/projects/project.query-config';

import { silentLogger } from '../../fixtures/logger.fixtures';
import { buildTestUsers } from '../../fixtures/actor-context.fixtures';
import {
  createExpiredToken as sharedCreateExpiredToken,
  createTokenWithWrongSecret as sharedCreateTokenWithWrongSecret,
} from '../../fixtures/tokens.fixtures';

export const SECRET_KEY = 'projects-test-secret-key';
export const WRONG_SECRET_KEY = 'projects-test-wrong-secret-key';
export const TOKEN_EXPIRES_IN_SECONDS = 3600;

export const testUsers = buildTestUsers('projects-');

export interface ProjectsTestContext {
  app: Application;
  tokenService: ITokenService;
  projectRepository: IProjectRepository;
  projectMemberRepository: IProjectMemberRepository;
  userRepository: IUserRepository;
  workspaceRoleRepository: IWorkspaceRoleRepository;
  unitOfWork: IUnitOfWork;
}

/**
 * Builds a projects test app whose request pipeline mirrors production: the
 * global passive authentication middleware runs before the projects router,
 * which guards every route with require-authentication.
 *
 * NB! The exposed repositories, token service, and unit-of-work are the SAME
 * instances injected into the authentication middleware and the project
 * service. Spy on them to inject failures.
 */
export function createProjectsTestContext(): ProjectsTestContext {
  const userRepository = new UserRepository(prisma, silentLogger);
  const workspaceRoleRepository = new WorkspaceRoleRepository(prisma, silentLogger);
  const projectMemberRepository = new ProjectMemberRepository(prisma, silentLogger);
  const projectRepository = new ProjectRepository(prisma, silentLogger);
  const unitOfWork = new PrismaUnitOfWork(prisma, silentLogger);

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

  const projectService = new ProjectService(
    projectRepository,
    projectMemberRepository,
    authorizationGuard,
    unitOfWork,
    silentLogger,
  );

  const projectsController = new ProjectsController(
    projectService,
    queryParser,
    projectsQueryConfig,
  );

  const app = express();
  app.set('query parser', 'extended');
  app.use(express.json());
  app.use(authenticationMiddleware);
  app.use('/api/v1/projects', projectsController.router);
  app.use(errorMiddleware);

  return {
    app,
    tokenService,
    projectRepository,
    projectMemberRepository,
    userRepository,
    workspaceRoleRepository,
    unitOfWork,
  };
}

export async function fetchProjectRoleIdByName(name: ProjectRoleName): Promise<string> {
  const role = await prisma.projectRole.findFirst({ where: { name } });
  if (!role) {
    throw new Error(`Expected project role ${name} to exist`);
  }
  return role.id;
}

/**
 * Seeds a project directly through Prisma (bypassing the controller/service).
 */
export async function seedProject(
  creatorId: string,
  name: string,
  description: string,
): Promise<{ id: string; name: string; description: string; creatorId: string }> {
  const project = await prisma.project.create({
    data: { name, description, creatorId },
    select: { id: true, name: true, description: true, creatorId: true },
  });
  return project;
}

/**
 * Enrolls a user as a member of a seeded project with the given project role.
 */
export async function seedProjectMembership(
  projectId: string,
  userId: string,
  projectRoleName: ProjectRoleName,
): Promise<{ projectId: string; projectRoleId: string; projectRoleName: ProjectRoleName }> {
  const projectRoleId = await fetchProjectRoleIdByName(projectRoleName);
  await prisma.projectMember.create({
    data: { projectId, userId, projectRoleId },
  });
  return { projectId, projectRoleId, projectRoleName };
}

/**
 * Mints an already-expired token for the given claims, bound to this fixture's
 * `SECRET_KEY` and `TOKEN_EXPIRES_IN_SECONDS`.
 */
export function createExpiredToken(userId: string, workspaceRoleId: string): string {
  return sharedCreateExpiredToken({
    secretKey: SECRET_KEY,
    expiresInSeconds: TOKEN_EXPIRES_IN_SECONDS,
    userId,
    workspaceRoleId,
  });
}

/**
 * Mints a token signed with a secret the middleware does not recognize, bound
 * to this fixture's `WRONG_SECRET_KEY` and `TOKEN_EXPIRES_IN_SECONDS`.
 */
export function createTokenWithWrongSecret(userId: string, workspaceRoleId: string): string {
  return sharedCreateTokenWithWrongSecret({
    wrongSecretKey: WRONG_SECRET_KEY,
    expiresInSeconds: TOKEN_EXPIRES_IN_SECONDS,
    userId,
    workspaceRoleId,
  });
}
