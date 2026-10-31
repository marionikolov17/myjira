'use client';

import { useQuery } from '@tanstack/react-query';
import { authClient } from '@/lib/api/client/auth';
import { queryKeys } from '@/lib/query/keys';
import { ME_STALE_TIME_MS } from '@/lib/query/staleTime';
import { useAuthStore } from '@/stores/authStore';

export function useMe() {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: async () => (await authClient.getCurrentUser()).data,
    enabled: Boolean(token),
    staleTime: ME_STALE_TIME_MS,
  });
}
