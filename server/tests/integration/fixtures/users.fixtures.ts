import { prisma } from '@/common/lib/prisma';
import { passwordHasher } from '@/common/password-hasher';
import { WorkspaceRoleName } from '@/modules/workspace-roles';

export interface TestUser {
  email: string;
  name: string;
  password: string;
  workspaceRoleName: WorkspaceRoleName;
}

export async function createTestUsers(testUsers: TestUser[]): Promise<void> {
  const mappedUsers = await Promise.all(
    testUsers.map((testUser) => mapTestUserToCreateUserParams(testUser)),
  );

  await prisma.user.createMany({ data: mappedUsers });
}

async function mapTestUserToCreateUserParams(testUser: TestUser) {
  const workspaceRole = await prisma.workspaceRole.findFirst({
    where: {
      name: testUser.workspaceRoleName,
    },
  });

  if (!workspaceRole) {
    throw new Error(`Workspace role ${testUser.workspaceRoleName} not found`);
  }

  return {
    email: testUser.email,
    name: testUser.name,
    password: await passwordHasher.hashPassword(testUser.password),
    workspaceRoleId: workspaceRole.id,
  };
}
