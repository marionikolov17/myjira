import { ActorContext } from '@/common/interfaces';
import { prisma } from '@/common/lib/prisma';
import { ITokenService } from '@/common/token-service/token-service.interface';
import { WorkspaceRoleName } from '@/modules/workspace-roles';

import { TestUser } from './users.fixtures';

export interface PersistedUser {
  id: string;
  workspaceRoleId: string;
  workspaceRoleName: WorkspaceRoleName;
}

/**
 * Builds a `TestUser` matrix (one per workspace role) using a file-unique
 * email/name prefix. The prefix keeps emails from colliding across integration
 * test files.
 */
export function buildTestUsers(emailPrefix: string): TestUser[] {
  return Object.values(WorkspaceRoleName).map((roleName) => {
    const slug = roleName.toLowerCase();
    return {
      email: `${emailPrefix}${slug}@example.com`,
      name: `${emailPrefix}${slug}`,
      password: `${emailPrefix}${slug}-password`,
      workspaceRoleName: roleName,
    };
  });
}

/**
 * Loads a seeded user by email and joins its workspace role, failing loudly
 * when either row is missing (indicates a seeding mistake in the spec).
 */
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
 * Loads every `TestUser` in `testUsers` as a `PersistedUser`, preserving order.
 */
export function fetchPersistedUsers(testUsers: TestUser[]): Promise<PersistedUser[]> {
  return Promise.all(testUsers.map((testUser) => fetchPersistedUser(testUser.email)));
}

/**
 * Builds an `ActorContext` from a persisted user and the project roles to
 * attach. Callers pass `ActorContext['projectRoles']` directly; callers that
 * hold `SeededProjectMembership[]` (or similar) should `.map(...)` into that
 * shape at the call site.
 */
export function userToActorContext(
  user: PersistedUser,
  projectRoles: ActorContext['projectRoles'],
): ActorContext {
  return {
    userId: user.id,
    workspaceRole: { id: user.workspaceRoleId, name: user.workspaceRoleName },
    projectRoles,
  };
}

/**
 * Wraps a raw JWT in the `Bearer` scheme expected by the Authorization header.
 */
export function bearer(token: string): string {
  return `Bearer ${token}`;
}

/**
 * Mints a Bearer header for the given actor using the supplied token service.
 * The spec passes its own `ctx.tokenService` so this helper never captures
 * subject-specific wiring.
 */
export function tokenFor(tokenService: ITokenService, actor: ActorContext): string {
  return bearer(
    tokenService.generateToken({
      userId: actor.userId,
      workspaceRoleId: actor.workspaceRole.id,
    }),
  );
}
