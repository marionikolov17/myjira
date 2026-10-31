'use client';

import { createMultiSelectFiltersHook } from '@/lib/filters/createMultiSelectFilters';

export const BOARD_FILTER_KEYS = ['priority', 'assignee'] as const;
export type BoardFilterKey = (typeof BOARD_FILTER_KEYS)[number];
export type BoardFilterValues = Record<BoardFilterKey, string[]>;

const useBoardFiltersBase = createMultiSelectFiltersHook({
  filterKeys: BOARD_FILTER_KEYS,
  urlKeys: {
    priority: 'boardPriority',
    assignee: 'boardAssignee',
  },
});

/** Board-only URL filters — namespaced so they do not clash with Issues tab params. */
export function useBoardFilters() {
  return useBoardFiltersBase();
}
