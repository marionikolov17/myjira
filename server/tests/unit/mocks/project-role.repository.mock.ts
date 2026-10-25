import { jest } from '@jest/globals';
import { IProjectRoleRepository } from '@/modules/project-roles';

export function createMockProjectRoleRepository(): jest.Mocked<IProjectRoleRepository> {
  return {
    resourceName: 'project_roles',
    getProjectRoles: jest.fn(),
    getProjectRoleById: jest.fn(),
    getProjectRoleIdByName: jest.fn(),
  };
}
