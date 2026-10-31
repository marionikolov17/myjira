import type { ListQuery } from '@/lib/api/schemas';

/**
 * Serialises a ListQuery to the server's exact shape, e.g.
 * `sort=-createdAt&filter[status][eq]=ToDo&filter[priority][in]=High,Medium&page=2&pageSize=20`
 * Brackets and list commas are intentionally left unencoded.
 */
export function serializeListQuery(query: ListQuery): string {
  const parts: string[] = [];

  if (query.sort) parts.push(`sort=${encodeURIComponent(query.sort)}`);

  for (const [field, ops] of Object.entries(query.filter ?? {})) {
    for (const [op, value] of Object.entries(ops)) {
      if (value === undefined) continue;

      if (Array.isArray(value)) {
        if (value.length === 0) continue;

        parts.push(
          `filter[${encodeURIComponent(field)}][${op}]=${value.map(encodeURIComponent).join(',')}`,
        );
      } else {
        parts.push(`filter[${encodeURIComponent(field)}][${op}]=${encodeURIComponent(value)}`);
      }
    }
  }

  if (query.page !== undefined) parts.push(`page=${query.page}`);
  if (query.pageSize !== undefined) parts.push(`pageSize=${query.pageSize}`);

  return parts.join('&');
}
