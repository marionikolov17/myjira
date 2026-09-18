import express, { Application } from 'express';

import { errorMiddleware, createAuthenticationMiddleware } from '@/common/middlewares';
import { prisma } from '@/common/lib/prisma';
import { JsonwebtokenTokenService } from '@/common/token-service/jsonwebtoken-token-service';
import { ITokenService } from '@/common/token-service/token-service.interface';
import { authorizationGuard } from '@/common/authorization';
import { queryParser } from '@/common/query';
import { CryptoActivationTokenService, IActivationTokenService } from '@/common/activation-token';

import { IUserRepository, UserRepository, UserService } from '@/modules/users';
import { IWorkspaceRoleRepository, WorkspaceRoleRepository } from '@/modules/workspace-roles';
import { IProjectMemberRepository, ProjectMemberRepository } from '@/modules/project-members';
import { UsersController } from '@/modules/users/user.controller';
import { usersQueryConfig } from '@/modules/users/user.query-config';
import { ActorContextService } from '@/modules/auth/actor-context.service';
import { WorkspaceRoleName } from '@/modules/workspace-roles';

import { silentLogger } from '../../fixtures/logger.fixtures';
import { TestUser } from '../../fixtures/users.fixtures';

export const SECRET_KEY = 'users-test-secret-key';
export const WRONG_SECRET_KEY = 'users-test-wrong-secret-key';
export const TOKEN_EXPIRES_IN_SECONDS = 3600;
export const ACTIVATION_URL_BASE = 'https://app.example.com/activate';
export const ACTIVATION_TOKEN_TTL_SECONDS = 3600;

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
  activationTokenService: IActivationTokenService;
  activationUrlBase: string;
}

/**
 * Builds a users test app whose request pipeline mirrors production: the global
 * passive authentication middleware runs before the users router, which guards
 * `/me` with the require-authentication middleware.
 *
 * The returned `tokenService` shares the same secret as the middleware, so it
 * can mint valid tokens for seeded users.
 *
 * NB! The exposed repositories and the activation-token service are the same
 * instances injected into the authentication middleware and the user service.
 * Spy on them to inject failures (e.g. a missing user, a missing workspace role,
 * a repository that throws, or a token service that throws during creation).
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

  const activationTokenService = CryptoActivationTokenService.create({
    ttlSeconds: ACTIVATION_TOKEN_TTL_SECONDS,
  });

  const userService = new UserService(
    userRepository,
    workspaceRoleRepository,
    authorizationGuard,
    activationTokenService,
    silentLogger,
    { activationUrlBase: ACTIVATION_URL_BASE },
  );

  const usersController = new UsersController(userService, queryParser, usersQueryConfig);

  const app = express();
  app.set('query parser', 'extended');
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
    activationTokenService,
    activationUrlBase: ACTIVATION_URL_BASE,
  };
}

export interface PersistedUser {
  id: string;
  workspaceRoleId: string;
  workspaceRoleName: WorkspaceRoleName;
}

export async function fetchPersistedUser(email: string): Promise<PersistedUser> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new Error(`Expected seeded user ${email} to exist`);
  }

  const workspaceRole = await prisma.workspaceRole.findUnique({
    where: { id: user.workspaceRoleId },
  });

  if (!workspaceRole) {
    throw new Error(`Expected workspace role ${user.workspaceRoleId} to exist`);
  }

  return {
    id: user.id,
    workspaceRoleId: user.workspaceRoleId,
    workspaceRoleName: workspaceRole.name as WorkspaceRoleName,
  };
}

/**
 * Returns the full persisted user row (including sensitive columns) so tests can
 * assert on the stored password, status, and activation-token hash.
 */
export async function fetchRawUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function fetchWorkspaceRoleIdByName(name: WorkspaceRoleName): Promise<string> {
  const role = await prisma.workspaceRole.findFirst({ where: { name } });
  if (!role) {
    throw new Error(`Expected workspace role ${name} to exist`);
  }
  return role.id;
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
