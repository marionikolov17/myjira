import type { ListQuery } from '@/lib/api/schemas';

export const queryKeys = {
  me: () => ['me'] as const,
  users: {
    all: () => ['users'] as const,
    list: (query: ListQuery) => ['users', 'list', query] as const,
    detail: (userId: string) => ['users', 'detail', userId] as const,
  },
  projects: {
    all: () => ['projects'] as const,
    list: (query: ListQuery) => ['projects', 'list', query] as const,
    detail: (projectId: string) => ['projects', 'detail', projectId] as const,
  },
  members: {
    all: () => ['members'] as const,
    list: (projectId: string) => ['members', projectId] as const,
  },
  issues: {
    all: () => ['issues'] as const,
    project: (projectId: string) => ['issues', projectId] as const,
    lists: (projectId: string) => ['issues', projectId, 'list'] as const,
    list: (projectId: string, query: ListQuery) => ['issues', projectId, 'list', query] as const,
    detail: (projectId: string, issueId: string) =>
      ['issues', projectId, 'detail', issueId] as const,
  },
};
