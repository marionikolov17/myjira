import express, { Application } from 'express';

import { errorMiddleware, createAuthenticationMiddleware } from '@/common/middlewares';
import { prisma } from '@/common/lib/prisma';
import { JsonwebtokenTokenService } from '@/common/token-service/jsonwebtoken-token-service';
import { ITokenService } from '@/common/token-service/token-service.interface';

import { IUserRepository, UserRepository } from '@/modules/users';
import { IWorkspaceRoleRepository, WorkspaceRoleRepository } from '@/modules/workspace-roles';
import { IProjectMemberRepository, ProjectMemberRepository } from '@/modules/project-members';
import { UsersController } from '@/modules/users/user.controller';
import { ActorContextService } from '@/modules/auth/actor-context.service';
import { WorkspaceRoleName } from '@/modules/workspace-roles';

import { silentLogger } from '../../fixtures/logger.fixtures';
import { TestUser } from '../../fixtures/users.fixtures';

export const SECRET_KEY = 'users-test-secret-key';
export const WRONG_SECRET_KEY = 'users-test-wrong-secret-key';
export const TOKEN_EXPIRES_IN_SECONDS = 3600;

export const testUsers: TestUser[] = Object.values(WorkspaceRoleName).map((roleName) => {
  const slug = roleName.toLowerCase();
  return {
    email: `users-me-${slug}@example.com`,
    name: `users-me-${slug}`,
    password: `users-me-${slug}-password`,
    workspaceRoleName: roleName,
  };
});

export interface UsersTestContext {
  app: Application;
  tokenService: ITokenService;
  userRepository: IUserRepository;
  workspaceRoleRepository: IWorkspaceRoleRepository;
  projectMemberRepository: IProjectMemberRepository;
}

/**
 * Builds a users test app whose request pipeline mirrors production: the global
 * passive authentication middleware runs before the users router, which guards
 * `/me` with the require-authentication middleware.
 *
 * The returned `tokenService` shares the same secret as the middleware, so it
 * can mint valid tokens for seeded users.
 *
 * NB! The exposed repositories are the same instances the authentication
 * middleware uses to build the actor context. Spy on them to inject failures
 * (e.g. a missing user, a missing workspace role, or a repository that throws).
 */
export function createUsersTestContext(): UsersTestContext {
  const userRepository = new UserRepository(prisma, silentLogger);
  const workspaceRoleRepository = new WorkspaceRoleRepository(prisma, silentLogger);
  const projectMemberRepository = new ProjectMemberRepository(prisma, silentLogger);

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

  const usersController = new UsersController();

  const app = express();
  app.use(express.json());
  app.use(authenticationMiddleware);
  app.use('/api/v1/users', usersController.router);
  app.use(errorMiddleware);

  return {
    app,
    tokenService,
    userRepository,
    workspaceRoleRepository,
    projectMemberRepository,
  };
}

export interface PersistedUser {
  id: string;
  workspaceRoleId: string;
}

export async function fetchPersistedUser(email: string): Promise<PersistedUser> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`Expected seeded user ${email} to exist`);
  }
  return { id: user.id, workspaceRoleId: user.workspaceRoleId };
}

/**
 * Mints an already-expired token for the given claims by signing with a token
 * service whose expiry is in the past.
 */
export function createExpiredToken(userId: string, workspaceRoleId: string): string {
  const expiredTokenService = JsonwebtokenTokenService.create({
    secretKey: SECRET_KEY,
    expiresIn: -TOKEN_EXPIRES_IN_SECONDS,
  });
  return expiredTokenService.generateToken({ userId, workspaceRoleId });
}

/**
 * Mints a token signed with a secret the middleware does not recognize, so
 * verification fails.
 */
export function createTokenWithWrongSecret(userId: string, workspaceRoleId: string): string {
  const wrongSecretTokenService = JsonwebtokenTokenService.create({
    secretKey: WRONG_SECRET_KEY,
    expiresIn: TOKEN_EXPIRES_IN_SECONDS,
  });
  return wrongSecretTokenService.generateToken({ userId, workspaceRoleId });
}
