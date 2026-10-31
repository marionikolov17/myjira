'use client';

import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { issuesClient } from '@/lib/api/client/issues';
import { OPEN_ISSUE_STATUSES, type Issue, type ListQuery } from '@/lib/api/schemas';
import { queryKeys } from '@/lib/query/keys';
import { DETAIL_STALE_TIME_MS } from '@/lib/query/staleTime';

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

const MY_OPEN_ISSUES_LIMIT = 10;

/**
 * Fans out one issues query per project and merges them client-side.
 * Returns a useQuery-like `{ data, isLoading, error, refetch }` shape.
 * Each underlying query still caches the full `Paginated<Issue>` envelope.
 */
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
    combine: (results) => ({
      data: mergeMyOpenIssues(results.map((result) => result.data)),
      isLoading: results.some((result) => result.isLoading),
      error: results.find((result) => result.error)?.error ?? null,
      refetch: () => {
        results.forEach((result) => void result.refetch());
      },
    }),
  });
}

function myOpenIssuesQuery(userId: string): ListQuery {
  return {
    filter: { assigneeId: { eq: userId }, status: { in: [...OPEN_ISSUE_STATUSES] } },
    sort: '-updatedAt',
    pageSize: MY_OPEN_ISSUES_LIMIT,
  };
}

/** Merge per-project paginated issue lists into a global top-N by `updatedAt`. */
function mergeMyOpenIssues(
  pages: Array<{ data?: Issue[] } | undefined | null>,
  limit = MY_OPEN_ISSUES_LIMIT,
): Issue[] {
  return pages
    .flatMap((page) => page?.data ?? [])
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}
