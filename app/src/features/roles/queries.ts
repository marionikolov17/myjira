'use client';

import { useQuery } from '@tanstack/react-query';
import { rolesClient } from '@/lib/api/client/roles';
import type {
  ProjectRole,
  ProjectRoleName,
  WorkspaceRole,
  WorkspaceRoleName,
} from '@/lib/api/schemas';
import { queryKeys } from '@/lib/query/keys';
import { useAuthStore } from '@/stores/authStore';

const STALE_TIME_MS = 10 * 60_000;

export function useWorkspaceRoles() {
  const token = useAuthStore((state) => state.token);
  const query = useQuery({
    queryKey: queryKeys.roles.workspace(),
    queryFn: async () => (await rolesClient.listWorkspaceRoles()).data,
    enabled: Boolean(token),
    staleTime: STALE_TIME_MS,
  });

  return {
    roles: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    byId: (id: string): WorkspaceRole | undefined => query.data?.find((role) => role.id === id),
    byName: (name: WorkspaceRoleName): WorkspaceRole | undefined =>
      query.data?.find((role) => role.name === name),
  };
}

export function useProjectRoles() {
  const token = useAuthStore((state) => state.token);
  const query = useQuery({
    queryKey: queryKeys.roles.project(),
    queryFn: async () => (await rolesClient.listProjectRoles()).data,
    enabled: Boolean(token),
    staleTime: STALE_TIME_MS,
  });

  return {
    roles: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    byId: (id: string): ProjectRole | undefined => query.data?.find((role) => role.id === id),
    byName: (name: ProjectRoleName): ProjectRole | undefined =>
      query.data?.find((role) => role.name === name),
  };
}
