'use client';

import { useQuery } from '@tanstack/react-query';
import { commentsClient } from '@/lib/api/client/comments';
import { queryKeys } from '@/lib/query/keys';

export function useIssueComments(
  projectId: string | undefined,
  issueId: string | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.comments.issue(projectId ?? '', issueId ?? ''),
    queryFn: async () => (await commentsClient.list(projectId as string, issueId as string)).data,
    enabled: Boolean(projectId && issueId) && (options.enabled ?? true),
  });
}
