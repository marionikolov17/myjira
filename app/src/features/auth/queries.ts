'use client'

import { useQuery } from '@tanstack/react-query'
import { authClient } from '@/lib/api/client/auth'
import { queryKeys } from '@/lib/query/keys'
import { useAuthStore } from '@/stores/authStore'

export function useMe() {
  const token = useAuthStore((state) => state.token)
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: async () => (await authClient.getCurrentUser()).data,
    enabled: Boolean(token),
    staleTime: 60_000,
  })
}
