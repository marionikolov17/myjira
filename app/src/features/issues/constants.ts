/**
 * Column-sort field tokens (no labeled dropdown — Issues uses DataTable header sorting).
 * Projects/Users use `*_SORT_OPTIONS` for OptionSelect dropdowns instead.
 */
export const ISSUE_SORT_FIELDS = [
  'title',
  '-title',
  'status',
  '-status',
  'priority',
  '-priority',
  'updatedAt',
  '-updatedAt',
  'createdAt',
  '-createdAt',
] as const;
export type IssueSortField = (typeof ISSUE_SORT_FIELDS)[number];
/** Alias for filter factories that expect a `*_SORT_VALUES` tuple. */
export const ISSUE_SORT_VALUES = ISSUE_SORT_FIELDS;

export const ISSUES_PAGE_SIZE = 15;
