import { jest } from '@jest/globals';
import { IIssueRepository } from '@/modules/issues';

export function createMockIssueRepository(): jest.Mocked<IIssueRepository> {
  return {
    resourceName: 'issues',
    createIssue: jest.fn(),
    findIssues: jest.fn(),
    getIssueById: jest.fn(),
    updateIssue: jest.fn(),
    deleteIssue: jest.fn(),
  };
}
