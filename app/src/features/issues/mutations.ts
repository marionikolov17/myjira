'use client';

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { issuesClient } from '@/lib/api/client/issues';
import type { CreateIssueInput, Issue, Paginated, UpdateIssueInput } from '@/lib/api/schemas';
import { queryKeys } from '@/lib/query/keys';

export function useCreateIssue(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateIssueInput) =>
      (await issuesClient.create(projectId, input)).data,
    onSuccess: (issue) => {
      queryClient.setQueryData(queryKeys.issues.detail(projectId, issue.id), issue);
      return queryClient.invalidateQueries({ queryKey: queryKeys.issues.lists(projectId) });
    },
  });
}

export type UpdateIssueVariables = {
  issueId: string;
  input: UpdateIssueInput;
  /** Fields to paint immediately that can't be derived from `input` (e.g. the assignee ref). */
  optimistic?: Partial<Issue>;
};

type Snapshot = {
  detail: Issue | undefined;
  lists: Array<[QueryKey, Paginated<Issue> | undefined]>;
};

export function useUpdateIssue(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<Issue, unknown, UpdateIssueVariables, Snapshot>({
    mutationFn: async ({ issueId, input }) =>
      (await issuesClient.update(projectId, issueId, input)).data,
    onMutate: async ({ issueId, input, optimistic }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.issues.project(projectId) });

      const detailKey = queryKeys.issues.detail(projectId, issueId);
      const snapshot: Snapshot = {
        detail: queryClient.getQueryData<Issue>(detailKey),
        lists: queryClient.getQueriesData<Paginated<Issue>>({
          queryKey: queryKeys.issues.lists(projectId),
        }),
      };

      const { assigneeId: _assigneeId, ...scalarPatch } = input;
      const patch: Partial<Issue> = {
        ...scalarPatch,
        ...optimistic,
        updatedAt: new Date().toISOString(),
      };
      const apply = (issue: Issue): Issue =>
        issue.id === issueId ? { ...issue, ...patch } : issue;

      queryClient.setQueryData<Issue>(detailKey, (current) => (current ? apply(current) : current));
      queryClient.setQueriesData<Paginated<Issue>>(
        { queryKey: queryKeys.issues.lists(projectId) },
        (current) => (current ? { ...current, data: current.data.map(apply) } : current),
      );

      return snapshot;
    },
    onError: (_error, { issueId }, snapshot) => {
      if (!snapshot) return;
      queryClient.setQueryData(queryKeys.issues.detail(projectId, issueId), snapshot.detail);
      for (const [key, data] of snapshot.lists) queryClient.setQueryData(key, data);
    },
    onSuccess: (issue) => {
      queryClient.setQueryData(queryKeys.issues.detail(projectId, issue.id), issue);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.issues.lists(projectId) }),
  });
}

export function useDeleteIssue(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (issueId: string) => issuesClient.remove(projectId, issueId),
    onSuccess: (_data, issueId) => {
      queryClient.removeQueries({ queryKey: queryKeys.issues.detail(projectId, issueId) });
      return queryClient.invalidateQueries({ queryKey: queryKeys.issues.lists(projectId) });
    },
  });
}
