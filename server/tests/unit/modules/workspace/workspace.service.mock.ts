import { jest } from '@jest/globals';
import { WorkspaceRole, WorkspaceRoleName } from '@/modules/workspace-roles';
import { CreateUserParams, User } from '@/modules/users';
import { IWorkspaceUsersConfig } from '@/config/workspace-users/workspace-users-config';
import { BootstrapWorkspaceConfigParams } from '@/modules/workspace/workspace.types';

const ADMIN_ROLE_ID = '7a4021a2-8876-482f-9d19-c344aa302560';
const OWNER_ROLE_ID = 'a53e993d-e974-497b-a9d9-85b49af18e2b';
const DEVELOPER_ROLE_ID = 'fc733d80-f92f-406c-adc1-d8ce8324ae32';

export const mockWorkspaceRoles: WorkspaceRole[] = [
  {
    id: ADMIN_ROLE_ID,
    name: WorkspaceRoleName.ADMIN,
    createdAt: new Date('2026-03-21'),
    updatedAt: new Date('2026-03-21'),
  },
  {
    id: OWNER_ROLE_ID,
    name: WorkspaceRoleName.OWNER,
    createdAt: new Date('2026-03-21'),
    updatedAt: new Date('2026-03-21'),
  },
  {
    id: DEVELOPER_ROLE_ID,
    name: WorkspaceRoleName.DEVELOPER,
    createdAt: new Date('2026-03-21'),
    updatedAt: new Date('2026-03-21'),
  },
];

export const mockHashedPassword = 'hashedPassword';
export const mockUsersConfig: CreateUserParams[] = [
  {
    name: 'Admin',
    email: 'admin@example.com',
    hashedPassword: mockHashedPassword,
    workspaceRoleId: ADMIN_ROLE_ID,
  },
  {
    name: 'Owner',
    email: 'owner@example.com',
    hashedPassword: mockHashedPassword,
    workspaceRoleId: OWNER_ROLE_ID,
  },
  {
    name: 'Developer',
    email: 'dev@example.com',
    hashedPassword: mockHashedPassword,
    workspaceRoleId: DEVELOPER_ROLE_ID,
  },
];

export const mockUsersAfterBulkCreate: User[] = [
  {
    id: '7a4021a2-8876-482f-9d19-c344aa302560',
    name: 'Admin',
    email: 'admin@example.com',
    workspaceRoleId: ADMIN_ROLE_ID,
    createdAt: new Date('2026-03-21'),
    updatedAt: new Date('2026-03-21'),
  },
  {
    id: 'a53e993d-e974-497b-a9d9-85b49af18e2b',
    name: 'Owner',
    email: 'owner@example.com',
    workspaceRoleId: OWNER_ROLE_ID,
    createdAt: new Date('2026-03-21'),
    updatedAt: new Date('2026-03-21'),
  },
  {
    id: 'fc733d80-f92f-406c-adc1-d8ce8324ae32',
    name: 'Developer',
    email: 'dev@example.com',
    workspaceRoleId: DEVELOPER_ROLE_ID,
    createdAt: new Date('2026-03-21'),
    updatedAt: new Date('2026-03-21'),
  },
];

export function createMockWorkspaceUsersConfig(): jest.Mocked<IWorkspaceUsersConfig> {
  return {
    getUsers: jest.fn(),
  };
}

export function createMockBootstrapWorkspaceConfig(): jest.Mocked<BootstrapWorkspaceConfigParams> {
  return {
    bootstrapToken: 'bootstrap-token',
  };
}
