import { QuerySort, SortDirection } from './query.types';

export interface ParsedSortToken {
  token: string;
  field: string;
  direction: SortDirection;
}

/**
 * Parses a single raw sort token (e.g. `"createdAt"` or `"-createdAt"`) into a
 * `{ field, direction }` pair. A leading `-` selects descending order; anything
 * else is ascending. Returns `null` when the token is empty (i.e. after trimming
 * the `-` prefix).
 */
export function parseSortToken(rawToken: string): ParsedSortToken | null {
  const token = rawToken.trim();
  if (token.length === 0) {
    return null;
  }

  const direction: SortDirection = token.startsWith('-') ? 'desc' : 'asc';
  const field = direction === 'desc' ? token.slice(1).trim() : token;

  if (field.length === 0) {
    return null;
  }

  return { token, field, direction };
}

export function isSortableField(field: string, sortableFields: string[]): boolean {
  return sortableFields.includes(field);
}

export function toQuerySort(parsed: ParsedSortToken): QuerySort {
  return { field: parsed.field, direction: parsed.direction };
}
