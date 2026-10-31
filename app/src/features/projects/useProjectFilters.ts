'use client';

import { createListFiltersHook, inFilter, toListQuery } from '@/lib/filters/createListFilters';
import type { ListQuery } from '@/lib/api/schemas';
import { PROJECT_SORT_VALUES, PROJECTS_PAGE_SIZE, type ProjectSort } from './constants';

export const PROJECT_FILTER_KEYS = ['creator'] as const;
export type ProjectFilterKey = (typeof PROJECT_FILTER_KEYS)[number];
export type ProjectFilterValues = Record<ProjectFilterKey, string[]>;

export const useProjectFilters = createListFiltersHook({
  filterKeys: PROJECT_FILTER_KEYS,
  sortValues: PROJECT_SORT_VALUES,
  defaultSort: '-updatedAt' satisfies ProjectSort,
});

export function projectFiltersToListQuery(
  filters: ReturnType<typeof useProjectFilters>,
): ListQuery {
  return toListQuery({
    page: filters.page,
    pageSize: PROJECTS_PAGE_SIZE,
    sort: filters.sort,
    filter: inFilter('creatorId', filters.values.creator),
  });
}
