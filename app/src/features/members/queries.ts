'use client'

import { useQuery } from '@tanstack/react-query'
import { membersClient } from '@/lib/api/client/members'
import { queryKeys } from '@/lib/query/keys'

export function useProjectMembers(projectId: string | undefined, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.members.list(projectId ?? ''),
    queryFn: async () => (await membersClient.list(projectId as string)).data,
    enabled: Boolean(projectId) && (options.enabled ?? true),
  })
}
