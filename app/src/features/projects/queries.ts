'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { projectsClient } from '@/lib/api/client/projects';
import type { ListQuery } from '@/lib/api/schemas';
import { queryKeys } from '@/lib/query/keys';

const DETAIL_STALE_TIME_MS = 5 * 60_000;

export function useProjects(query: ListQuery, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.projects.list(query),
    queryFn: () => projectsClient.list(query),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.projects.detail(projectId ?? ''),
    queryFn: async () => (await projectsClient.getById(projectId as string)).data,
    enabled: Boolean(projectId),
    staleTime: DETAIL_STALE_TIME_MS,
  });
}
