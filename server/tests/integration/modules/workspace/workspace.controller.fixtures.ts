import { prisma } from '@/common/lib/prisma';
import { passwordHasher } from '@/common/password-hasher';
import { WorkspaceUserConfig } from '@/config/workspace-users/workspace-user-config';
import { WorkspaceUsersConfig } from '@/config/workspace-users/workspace-users-config';
import { IUserRepository, UserRepository } from '@/modules/users';
import {
  IWorkspaceRoleRepository,
  WorkspaceRoleName,
  WorkspaceRoleRepository,
} from '@/modules/workspace-roles';
import { WorkspaceController } from '@/modules/workspace/workspace.controller';
import { WorkspaceService } from '@/modules/workspace/workspace.service';

import { silentLogger } from '../../fixtures/logger.fixtures';

export const testUsers = Object.values(WorkspaceRoleName).map((roleName) => {
  const slug = roleName.toLowerCase();
  return {
    email: `test-${slug}@example.com`,
    name: `test-${slug}`,
    password: `test-${slug}-password`,
    workspaceRoleName: roleName,
  };
});

export type TestUser = (typeof testUsers)[number];

export interface WorkspaceTestContext {
  controller: WorkspaceController;
  userRepository: IUserRepository;
  workspaceRoleRepository: IWorkspaceRoleRepository;
  bootstrapToken: string;
}

/**
 * Creates a workspace test context with real Prisma-backed repositories.
 *
 * NB! The exposed `userRepository` and `workspaceRoleRepository` are the
 * same instances injected into the controller. Spy on them to inject failures.
 * @returns A workspace test context.
 */
export function createWorkspaceTestContext(): WorkspaceTestContext {
  const userRepository = new UserRepository(prisma, silentLogger);
  const workspaceRoleRepository = new WorkspaceRoleRepository(prisma, silentLogger);

  const workspaceUsersConfig = new WorkspaceUsersConfig(
    testUsers.map(
      (user) =>
        new WorkspaceUserConfig(
          user.email,
          user.name,
          user.password,
          user.workspaceRoleName,
          passwordHasher,
        ),
    ),
  );

  const bootstrapToken = 'test-token';

  const service = new WorkspaceService(
    userRepository,
    workspaceRoleRepository,
    workspaceUsersConfig,
    silentLogger,
    {
      bootstrapToken,
    },
  );

  const controller = new WorkspaceController(service);

  return {
    controller,
    userRepository,
    workspaceRoleRepository,
    bootstrapToken,
  };
}
