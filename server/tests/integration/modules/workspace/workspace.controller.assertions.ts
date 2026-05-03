import { expect } from '@jest/globals';

import { prisma } from '@/common/lib/prisma';
import { passwordHasher } from '@/common/password-hasher';
import { User, UserSchema } from '@/modules/users';
import { WorkspaceRole } from '@/modules/workspace-roles';

import { TestUser } from './workspace.controller.fixtures';

export function expectUsersResponse(
  users: User[],
  workspaceRoles: WorkspaceRole[],
  testUsers: TestUser[],
): void {
  expect(users).toHaveLength(testUsers.length);

  for (const testUser of testUsers) {
    const user = findUser(users, testUser.email);
    expectUserSchema(user);
    expectUserMatchesTestUser(user, testUser, workspaceRoles);
  }
}

function findUser(users: User[], email: string): User | undefined {
  return users.find((user) => user.email === email);
}

function expectUserSchema(user: User | undefined): void {
  expect(user).toBeDefined();
  expect(() => UserSchema.parse(user)).not.toThrow();
}

function expectUserMatchesTestUser(
  user: User | undefined,
  testUser: TestUser,
  workspaceRoles: WorkspaceRole[],
): void {
  expect(user?.name).toBe(testUser.name);
  expect(user?.email).toBe(testUser.email);

  const expectedRole = workspaceRoles.find((role) => role.name === testUser.workspaceRoleName);
  expect(expectedRole).toBeDefined();
  expect(user?.workspaceRoleId).toBe(expectedRole?.id);
}

export function expectUsersToNotContainPasswords(users: User[]): void {
  for (const user of users) {
    expect(user).not.toHaveProperty('password');
  }
}

export async function expectUsersInDatabase(testUsers: TestUser[]): Promise<void> {
  const dbUsers = await fetchUsersFromDatabase();

  expect(dbUsers).toHaveLength(testUsers.length);

  await Promise.all(
    testUsers.map(async (testUser) => {
      const dbUser = dbUsers.find((u) => u.email === testUser.email);
      expect(dbUser).toBeDefined();

      expect(dbUser?.name).toBe(testUser.name);
      expect(dbUser?.workspaceRole.name).toBe(testUser.workspaceRoleName);

      await expectPasswordIsHashed(dbUser?.password, testUser.password);
    }),
  );
}

async function fetchUsersFromDatabase() {
  return prisma.user.findMany({
    include: { workspaceRole: true },
  });
}

async function expectPasswordIsHashed(
  storedPassword: string | undefined,
  initialPassword: string,
): Promise<void> {
  expect(storedPassword).toBeDefined();
  expect(storedPassword).not.toBe(initialPassword);
  expect(await passwordHasher.verifyPassword(initialPassword, storedPassword ?? '')).toBe(true);
}

export async function expectNoUsersInDatabase(): Promise<void> {
  expect(await prisma.user.count()).toBe(0);
}
