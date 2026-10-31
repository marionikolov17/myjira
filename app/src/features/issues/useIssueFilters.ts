'use client';

import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs';
import { ISSUE_SORT_FIELDS, type IssueSortField } from './schemas';

export const ISSUE_FILTER_KEYS = ['status', 'priority', 'assignee', 'creator'] as const;
export type IssueFilterKey = (typeof ISSUE_FILTER_KEYS)[number];
export type IssueFilterValues = Record<IssueFilterKey, string[]>;

const DEFAULT_SORT: IssueSortField = '-updatedAt';
const listParser = parseAsArrayOf(parseAsString).withDefault([]);

const issueFilterParsers = {
  status: listParser,
  priority: listParser,
  assignee: listParser,
  creator: listParser,
  sort: parseAsStringLiteral(ISSUE_SORT_FIELDS).withDefault(DEFAULT_SORT),
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
    setSort: (sort: string | null) => {
      const value = (ISSUE_SORT_FIELDS as readonly string[]).includes(sort ?? '')
        ? (sort as IssueSortField)
        : null;
      void setState({ sort: value, page: null });
    },
    setPage: (page: number) => void setState({ page: page <= 1 ? null : page }),
  };
}
