'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { commentsClient } from '@/lib/api/client/comments';
import type { CreateCommentInput } from '@/lib/api/schemas';
import { queryKeys } from '@/lib/query/keys';

export function useCreateIssueComment(projectId: string, issueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCommentInput) =>
      (await commentsClient.create(projectId, issueId, input)).data,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.comments.issue(projectId, issueId),
      }),
  });
}

export function useDeleteIssueComment(projectId: string, issueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => commentsClient.remove(projectId, issueId, commentId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.comments.issue(projectId, issueId),
      }),
  });
}
