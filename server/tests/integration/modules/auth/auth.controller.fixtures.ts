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

export const testUsers: TestUser[] = Object.values(WorkspaceRoleName).map((roleName) => {
  const slug = roleName.toLowerCase();
  return {
    email: `auth-test-${slug}@example.com`,
    name: `auth-test-${slug}`,
    password: `auth-test-${slug}-password`,
    workspaceRoleName: roleName,
  };
});

export interface AuthTestContext {
  controller: AuthController;
  userRepository: IUserRepository;
  tokenService: ITokenService;
  passwordHasher: IPasswordHasher;
}

/**
 * Creates an auth test context with real Prisma-backed repositories.
 * @returns An auth test context.
 */
export function createAuthTestContext(): AuthTestContext {
  const secretKey = 'test-secret-key';
  const expiresIn = 3600;
  const saltRounds = 10;

  const userRepository = new UserRepository(prisma, silentLogger);

  const tokenService = JsonwebtokenTokenService.create({ secretKey, expiresIn });
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
