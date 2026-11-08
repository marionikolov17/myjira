import { jest } from '@jest/globals';
import { ICommentRepository } from '@/modules/comments';

export function createMockCommentRepository(): jest.Mocked<ICommentRepository> {
  return {
    resourceName: 'comments',
    createComment: jest.fn(),
    getCommentsByIssueId: jest.fn(),
    getCommentById: jest.fn(),
    deleteComment: jest.fn(),
  };
}
