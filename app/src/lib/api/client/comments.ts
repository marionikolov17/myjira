import type { CreateCommentInput } from '@/lib/api/schemas';
import { transport } from '@/lib/api/transport';

export const commentsClient = {
  list: (projectId: string, issueId: string) => transport.listComments(projectId, issueId),
  create: (projectId: string, issueId: string, input: CreateCommentInput) =>
    transport.createComment(projectId, issueId, input),
  remove: (projectId: string, issueId: string, commentId: string) =>
    transport.deleteComment(projectId, issueId, commentId),
};
