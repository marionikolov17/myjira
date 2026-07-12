import { jest } from '@jest/globals';
import { IProjectMemberRepository } from '@/modules/project-members';

export function createMockProjectMemberRepository(): jest.Mocked<IProjectMemberRepository> {
  return {
    resourceName: 'project_members',
    getProjectMembersByUserId: jest.fn(),
  };
}
