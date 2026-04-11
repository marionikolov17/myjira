import { jest } from '@jest/globals';
import { IWorkspaceRoleRepository } from '@/modules/workspace-roles';

export function createMockWorkspaceRoleRepository(): jest.Mocked<IWorkspaceRoleRepository> {
  return {
    resourceName: 'workspace-roles',
    getWorkspaceRoles: jest.fn(),
  };
}
