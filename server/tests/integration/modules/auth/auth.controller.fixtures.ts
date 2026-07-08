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

/**
 * Builds denormalized variants of an email that should all normalize (trim +
 * lowercase) back to the original, canonical address.
 */
export function denormalizedEmailVariants(email: string): { case: string; email: string }[] {
  return [
    { case: 'uppercased', email: email.toUpperCase() },
    { case: 'mixed case', email: toMixedCase(email) },
    { case: 'leading whitespace', email: `   ${email}` },
    { case: 'trailing whitespace', email: `${email}   ` },
    { case: 'surrounding whitespace', email: `  ${email}  ` },
    { case: 'surrounding whitespace and uppercased', email: `  ${email.toUpperCase()}  ` },
  ];
}

function toMixedCase(value: string): string {
  return [...value]
    .map((char, index) => (index % 2 === 0 ? char.toUpperCase() : char.toLowerCase()))
    .join('');
}

/**
 * Builds variants of a password that differ from the original only by casing or
 * surrounding whitespace. Passwords are exact-match secrets, so every variant
 * must FAIL to authenticate. This is the deliberate counterpart to
 * `denormalizedEmailVariants`: it guards against a password ever being trimmed
 * or case-folded the way emails are.
 */
export function nonMatchingPasswordVariants(
  password: string,
): { case: string; password: string }[] {
  return [
    { case: 'uppercased', password: password.toUpperCase() },
    { case: 'mixed case', password: toMixedCase(password) },
    { case: 'leading whitespace', password: `   ${password}` },
    { case: 'trailing whitespace', password: `${password}   ` },
    { case: 'surrounding whitespace', password: `  ${password}  ` },
  ];
}

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
