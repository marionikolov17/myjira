import { jest } from '@jest/globals';
import { IProjectMemberRepository } from '@/modules/project-members';

export function createMockProjectMemberRepository(): jest.Mocked<IProjectMemberRepository> {
  return {
    resourceName: 'project_members',
    getProjectMembersByUserId: jest.fn(),
    getProjectMemberByUserAndProject: jest.fn(),
    createProjectMember: jest.fn(),
    listProjectMembers: jest.fn(),
    getProjectMemberById: jest.fn(),
    updateProjectMemberRole: jest.fn(),
    deleteProjectMember: jest.fn(),
  };
}
