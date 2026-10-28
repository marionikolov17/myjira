'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usersClient } from '@/lib/api/client/users'
import type { CreateUserInput } from '@/lib/api/schemas'
import { queryKeys } from '@/lib/query/keys'

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateUserInput) => (await usersClient.create(input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all() }),
  })
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, workspaceRoleId }: { userId: string; workspaceRoleId: string }) =>
      (await usersClient.updateRole(userId, { workspaceRoleId })).data,
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.users.detail(user.id), user)
      return queryClient.invalidateQueries({ queryKey: queryKeys.users.all() })
    },
  })
}
