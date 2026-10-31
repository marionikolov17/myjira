'use client';

import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { issuesClient } from '@/lib/api/client/issues';
import type { Issue, ListQuery } from '@/lib/api/schemas';
import { queryKeys } from '@/lib/query/keys';

const DETAIL_STALE_TIME_MS = 5 * 60_000;

export function useProjectIssues(
  projectId: string,
  query: ListQuery,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.issues.list(projectId, query),
    queryFn: () => issuesClient.list(projectId, query),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function useIssue(projectId: string | undefined, issueId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.issues.detail(projectId ?? '', issueId ?? ''),
    queryFn: async () => (await issuesClient.getById(projectId as string, issueId as string)).data,
    enabled: Boolean(projectId && issueId),
    staleTime: DETAIL_STALE_TIME_MS,
  });
}

export const BOARD_QUERY: ListQuery = { pageSize: 100, sort: '-updatedAt' };

export function useBoardIssues(projectId: string) {
  return useProjectIssues(projectId, BOARD_QUERY);
}

export function myOpenIssuesQuery(userId: string): ListQuery {
  return {
    filter: { assigneeId: { eq: userId }, status: { in: ['ToDo', 'InProgress'] } },
    sort: '-updatedAt',
    pageSize: 5,
  };
}

/** Fans out one issues query per project and merges them client-side. */
export function useMyOpenIssues(projectIds: string[], userId: string | undefined) {
  return useQueries({
    queries: projectIds.map((projectId) => {
      const query = myOpenIssuesQuery(userId ?? '');
      return {
        queryKey: queryKeys.issues.list(projectId, query),
        queryFn: () => issuesClient.list(projectId, query),
        enabled: Boolean(userId),
      };
    }),
    combine: (results) => {
      const issues: Issue[] = results
        .flatMap((result) => result.data?.data ?? [])
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 10);
      return {
        issues,
        isLoading: results.some((result) => result.isLoading),
        error: results.find((result) => result.error)?.error ?? null,
        refetch: () => results.forEach((result) => void result.refetch()),
      };
    },
  });
}
