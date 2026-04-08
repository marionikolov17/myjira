import { jest } from '@jest/globals';
import { WorkspaceRoleSchema } from '@/modules/workspace-roles';
import { UserSchema } from '@/modules/users';
import { env } from '@/config/env';

export const mockDatabaseWorkspaceRoles = [
  {
    id: '7a4021a2-8876-482f-9d19-c344aa302560',
    name: 'Admin',
    created_at: new Date('2026-03-21T00:00:00.000Z'),
    updated_at: new Date('2026-03-21T00:00:00.000Z'),
  },
  {
    id: 'a53e993d-e974-497b-a9d9-85b49af18e2b',
    name: 'Owner',
    created_at: new Date('2026-03-21T00:00:00.000Z'),
    updated_at: new Date('2026-03-21T00:00:00.000Z'),
  },
  {
    id: 'fc733d80-f92f-406c-adc1-d8ce8324ae32',
    name: 'Developer',
    created_at: new Date('2026-03-21T00:00:00.000Z'),
    updated_at: new Date('2026-03-21T00:00:00.000Z'),
  },
];
export const mockWorkspaceRoles = mockDatabaseWorkspaceRoles.map((role) =>
  WorkspaceRoleSchema.parse(role),
);

export const mockHashedPassword = 'hashedPassword';
export const mockUsersConfig = [
  {
    name: env.ADMIN_NAME,
    email: env.ADMIN_EMAIL,
    hashedPassword: mockHashedPassword,
    workspaceRoleId: mockDatabaseWorkspaceRoles[0]?.id,
  },
  {
    name: env.OWNER_NAME,
    email: env.OWNER_EMAIL,
    hashedPassword: mockHashedPassword,
    workspaceRoleId: mockDatabaseWorkspaceRoles[1]?.id,
  },
  {
    name: env.DEVELOPER_NAME,
    email: env.DEVELOPER_EMAIL,
    hashedPassword: mockHashedPassword,
    workspaceRoleId: mockDatabaseWorkspaceRoles[2]?.id,
  },
];

export const mockDatabaseUsersAfterBulkCreate = [
  {
    id: '7a4021a2-8876-482f-9d19-c344aa302560',
    name: mockUsersConfig[0]?.name,
    email: mockUsersConfig[0]?.email,
    workspace_role_id: mockUsersConfig[0]?.workspaceRoleId,
    created_at: new Date('2026-03-21T00:00:00.000Z'),
    updated_at: new Date('2026-03-21T00:00:00.000Z'),
  },
  {
    id: 'a53e993d-e974-497b-a9d9-85b49af18e2b',
    name: mockUsersConfig[1]?.name,
    email: mockUsersConfig[1]?.email,
    workspace_role_id: mockUsersConfig[1]?.workspaceRoleId,
    created_at: new Date('2026-03-21T00:00:00.000Z'),
    updated_at: new Date('2026-03-21T00:00:00.000Z'),
  },
  {
    id: 'fc733d80-f92f-406c-adc1-d8ce8324ae32',
    name: mockUsersConfig[2]?.name,
    email: mockUsersConfig[2]?.email,
    workspace_role_id: mockUsersConfig[2]?.workspaceRoleId,
    created_at: new Date('2026-03-21T00:00:00.000Z'),
    updated_at: new Date('2026-03-21T00:00:00.000Z'),
  },
];
export const mockUsersAfterBulkCreate = mockDatabaseUsersAfterBulkCreate.map((user) =>
  UserSchema.parse(user),
);

export function createMockUserRepository(bulkCreateUsersResponse: unknown) {
  return {
    bulkCreateUsers:
      bulkCreateUsersResponse instanceof Error
        ? jest.fn().mockRejectedValue(bulkCreateUsersResponse as never)
        : jest.fn().mockResolvedValue(bulkCreateUsersResponse as never),
  };
}

export function createMockWorkspaceRoleRepository(getWorkspaceRolesResponse: unknown) {
  return {
    resourceName: 'WorkspaceRole',
    getWorkspaceRoles:
      getWorkspaceRolesResponse instanceof Error
        ? jest.fn().mockRejectedValue(getWorkspaceRolesResponse as never)
        : jest.fn().mockResolvedValue(getWorkspaceRolesResponse as never),
  };
}

export function createMockWorkspaceUsersConfig(getUsersResponse: unknown) {
  return {
    getUsers:
      getUsersResponse instanceof Error
        ? jest.fn().mockRejectedValue(getUsersResponse as never)
        : jest.fn().mockResolvedValue(getUsersResponse as never),
  };
}

export function createMockBootstrapWorkspaceConfig(bootstrapToken: string) {
  return {
    bootstrapToken,
  };
}
