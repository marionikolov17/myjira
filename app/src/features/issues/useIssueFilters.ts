'use client';

import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates } from 'nuqs';

export const ISSUE_FILTER_KEYS = ['status', 'priority', 'assignee', 'creator'] as const;
export type IssueFilterKey = (typeof ISSUE_FILTER_KEYS)[number];
export type IssueFilterValues = Record<IssueFilterKey, string[]>;

const listParser = parseAsArrayOf(parseAsString).withDefault([]);

const issueFilterParsers = {
  status: listParser,
  priority: listParser,
  assignee: listParser,
  creator: listParser,
  sort: parseAsString,
  page: parseAsInteger.withDefault(1),
};

export function useIssueFilters() {
  const [state, setState] = useQueryStates(issueFilterParsers, { history: 'replace' });

  const values: IssueFilterValues = {
    status: state.status,
    priority: state.priority,
    assignee: state.assignee,
    creator: state.creator,
  };

  return {
    values,
    sort: state.sort,
    page: Math.max(1, state.page),
    setFilter: (key: IssueFilterKey, next: string[]) =>
      void setState({ [key]: next.length > 0 ? next : null, page: null }),
    clearFilters: () =>
      void setState({ status: null, priority: null, assignee: null, creator: null, page: null }),
    setSort: (sort: string | null) => void setState({ sort, page: null }),
    setPage: (page: number) => void setState({ page: page <= 1 ? null : page }),
  };
}
