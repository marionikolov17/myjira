export const PROJECT_SORT_OPTIONS = [
  { value: '-updatedAt', label: 'Recently updated' },
  { value: 'updatedAt', label: 'Least recently updated' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: '-name', label: 'Name (Z–A)' },
  { value: '-createdAt', label: 'Newest first' },
  { value: 'createdAt', label: 'Oldest first' },
] as const;

export type ProjectSort = (typeof PROJECT_SORT_OPTIONS)[number]['value'];
export const PROJECT_SORT_VALUES = PROJECT_SORT_OPTIONS.map(
  (option) => option.value,
) as unknown as [ProjectSort, ...ProjectSort[]];

export const PROJECTS_PAGE_SIZE = 9;
