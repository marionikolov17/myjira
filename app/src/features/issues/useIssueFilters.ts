'use client';

import {
  createListFiltersHook,
  inFilter,
  mergeFilters,
  toListQuery,
} from '@/lib/filters/createListFilters';
import type { ListQuery } from '@/lib/api/schemas';
import { ISSUE_SORT_FIELDS, ISSUES_PAGE_SIZE, type IssueSortField } from './schemas';

export const ISSUE_FILTER_KEYS = ['status', 'priority', 'assignee', 'creator'] as const;
export type IssueFilterKey = (typeof ISSUE_FILTER_KEYS)[number];
export type IssueFilterValues = Record<IssueFilterKey, string[]>;

const useIssueFiltersBase = createListFiltersHook({
  filterKeys: ISSUE_FILTER_KEYS,
  sortValues: ISSUE_SORT_FIELDS,
  defaultSort: '-updatedAt' satisfies IssueSortField,
});

export function useIssueFilters() {
  return useIssueFiltersBase();
}

export function issueFiltersToListQuery(filters: ReturnType<typeof useIssueFilters>): ListQuery {
  return toListQuery({
    page: filters.page,
    pageSize: ISSUES_PAGE_SIZE,
    sort: filters.sort,
    filter: mergeFilters(
      inFilter('status', filters.values.status),
      inFilter('priority', filters.values.priority),
      inFilter('assigneeId', filters.values.assignee),
      inFilter('creatorId', filters.values.creator),
    ),
  });
}
