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
import { ROLES_STALE_TIME_MS } from '@/lib/query/staleTime';
import { useAuthStore } from '@/stores/authStore';

export function roleById<T extends { id: string }>(
  roles: T[] | undefined,
  id: string,
): T | undefined {
  return roles?.find((role) => role.id === id);
}

export function workspaceRoleByName(
  roles: WorkspaceRole[] | undefined,
  name: WorkspaceRoleName,
): WorkspaceRole | undefined {
  return roles?.find((role) => role.name === name);
}

export function projectRoleByName(
  roles: ProjectRole[] | undefined,
  name: ProjectRoleName,
): ProjectRole | undefined {
  return roles?.find((role) => role.name === name);
}

export function useWorkspaceRoles() {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: queryKeys.roles.workspace(),
    queryFn: async () => (await rolesClient.listWorkspaceRoles()).data,
    enabled: Boolean(token),
    staleTime: ROLES_STALE_TIME_MS,
  });
}

export function useProjectRoles() {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: queryKeys.roles.project(),
    queryFn: async () => (await rolesClient.listProjectRoles()).data,
    enabled: Boolean(token),
    staleTime: ROLES_STALE_TIME_MS,
  });
}
