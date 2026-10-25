import { jest } from '@jest/globals';
import { IProjectRepository } from '@/modules/projects/project.interface';

export function createMockProjectRepository(): jest.Mocked<IProjectRepository> {
  return {
    resourceName: 'projects',
    createProject: jest.fn(),
    findProjects: jest.fn(),
    getProjectById: jest.fn(),
    updateProject: jest.fn(),
    deleteProject: jest.fn(),
  };
}
