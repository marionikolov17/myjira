'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsClient } from '@/lib/api/client/projects';
import type { CreateProjectInput, UpdateProjectInput } from '@/lib/api/schemas';
import { queryKeys } from '@/lib/query/keys';

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProjectInput) => (await projectsClient.create(input)).data,
    onSuccess: async (project) => {
      queryClient.setQueryData(queryKeys.projects.detail(project.id), project);
      // The creator becomes ProjectOwner, so the actor context must be refreshed.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.me() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() }),
      ]);
    },
  });
}

export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateProjectInput) =>
      (await projectsClient.update(projectId, input)).data,
    onSuccess: (project) => {
      queryClient.setQueryData(queryKeys.projects.detail(projectId), project);
      return queryClient.invalidateQueries({ queryKey: ['projects', 'list'] });
    },
  });
}

export function useDeleteProject(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => projectsClient.remove(projectId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: queryKeys.projects.detail(projectId) });
      queryClient.removeQueries({ queryKey: queryKeys.issues.project(projectId) });
      queryClient.removeQueries({ queryKey: queryKeys.members.list(projectId) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.me() }),
        queryClient.invalidateQueries({ queryKey: ['projects', 'list'] }),
      ]);
    },
  });
}
