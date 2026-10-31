'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { usersClient } from '@/lib/api/client/users';
import type { ListQuery } from '@/lib/api/schemas';
import { queryKeys } from '@/lib/query/keys';
import { DETAIL_STALE_TIME_MS } from '@/lib/query/staleTime';

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
