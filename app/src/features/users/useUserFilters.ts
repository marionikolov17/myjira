'use client';

import {
  createListFiltersHook,
  inFilter,
  mergeFilters,
  toListQuery,
} from '@/lib/filters/createListFilters';
import type { ListQuery } from '@/lib/api/schemas';
import { USER_SORT_VALUES, USERS_PAGE_SIZE, type UserSort } from './constants';

export const USER_FILTER_KEYS = ['status', 'role'] as const;
export type UserFilterKey = (typeof USER_FILTER_KEYS)[number];
export type UserFilterValues = Record<UserFilterKey, string[]>;

export const useUserFilters = createListFiltersHook({
  filterKeys: USER_FILTER_KEYS,
  sortValues: USER_SORT_VALUES,
  defaultSort: 'name' satisfies UserSort,
});

export function userFiltersToListQuery(filters: ReturnType<typeof useUserFilters>): ListQuery {
  return toListQuery({
    page: filters.page,
    pageSize: USERS_PAGE_SIZE,
    sort: filters.sort,
    filter: mergeFilters(
      inFilter('status', filters.values.status),
      inFilter('workspaceRoleId', filters.values.role),
    ),
  });
}
