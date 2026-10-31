'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { usersClient } from '@/lib/api/client/users';
import type { ListQuery } from '@/lib/api/schemas';
import { queryKeys } from '@/lib/query/keys';

const DETAIL_STALE_TIME_MS = 5 * 60_000;

export function useUsers(query: ListQuery, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.users.list(query),
    queryFn: () => usersClient.list(query),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function useUser(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.users.detail(userId ?? ''),
    queryFn: async () => (await usersClient.getById(userId as string)).data,
    enabled: Boolean(userId),
    staleTime: DETAIL_STALE_TIME_MS,
  });
}
