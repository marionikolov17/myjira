import { AuthController } from '@/modules/auth/auth.controller';
import { AuthService } from '@/modules/auth/auth.service';
import { IUserRepository, UserRepository } from '@/modules/users';
import { WorkspaceRoleName } from '@/modules/workspace-roles';

import { prisma } from '@/common/lib/prisma';
import { JsonwebtokenTokenService } from '@/common/token-service/jsonwebtoken-token-service';
import { ITokenService } from '@/common/token-service/token-service.interface';
import { IPasswordHasher } from '@/common/password-hasher/password-hasher.interface';
import { BcryptPasswordHasher } from '@/common/password-hasher/bcrypt-password-hasher';

import { silentLogger } from '../../fixtures/logger.fixtures';
import { TestUser } from '../../fixtures/users.fixtures';

export const TOKEN_EXPIRES_IN_SECONDS = 3600;

export const testUsers: TestUser[] = Object.values(WorkspaceRoleName).map((roleName) => {
  const slug = roleName.toLowerCase();
  return {
    email: `auth-test-${slug}@example.com`,
    name: `auth-test-${slug}`,
    password: `auth-test-${slug}-password`,
    workspaceRoleName: roleName,
  };
});

const [firstTestUser] = testUsers;
if (!firstTestUser) {
  throw new Error('Expected at least one workspace role to derive a test user from');
}

export const primaryTestUser: TestUser = firstTestUser;

export interface AuthTestContext {
  controller: AuthController;
  userRepository: IUserRepository;
  tokenService: ITokenService;
  passwordHasher: IPasswordHasher;
}

/**
 * Creates an auth test context with real Prisma-backed repositories.
 *
 * NB! The exposed `userRepository`, `tokenService` and `passwordHasher` are the
 * same instances injected into the controller. Spy on them to inject failures.
 * @returns An auth test context.
 */
export function createAuthTestContext(): AuthTestContext {
  const secretKey = 'test-secret-key';
  const saltRounds = 10;

  const userRepository = new UserRepository(prisma, silentLogger);

  const tokenService = JsonwebtokenTokenService.create({
    secretKey,
    expiresIn: TOKEN_EXPIRES_IN_SECONDS,
  });
  const passwordHasher = BcryptPasswordHasher.create({ saltRounds });

  const authService = new AuthService(userRepository, tokenService, passwordHasher, silentLogger);
  const controller = new AuthController(authService);

  return {
    controller,
    userRepository,
    tokenService,
    passwordHasher,
  };
}
