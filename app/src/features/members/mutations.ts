'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { membersClient } from '@/lib/api/client/members'
import type { AddProjectMemberInput } from '@/lib/api/schemas'
import { queryKeys } from '@/lib/query/keys'

export function useAddMember(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: AddProjectMemberInput) => (await membersClient.add(projectId, input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.members.list(projectId) }),
  })
}

export function useUpdateMemberRole(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ memberId, projectRoleId }: { memberId: string; projectRoleId: string }) =>
      (await membersClient.updateRole(projectId, memberId, { projectRoleId })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.members.list(projectId) }),
  })
}

export function useRemoveMember(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (memberId: string) => membersClient.remove(projectId, memberId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.members.list(projectId) }),
  })
}
