import { FILTER_OPS, type FilterOp, type ListFilter, type ListQuery } from '@/lib/api/schemas';

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

const FILTER_KEY = /^filter\[([^\]]+)\]\[([^\]]+)\]$/;

function isFilterOp(value: string): value is FilterOp {
  return (FILTER_OPS as readonly string[]).includes(value);
}

export type ParsedListQuery = ListQuery & { unknownOps: Array<{ field: string; op: string }> };

export function parseListQuery(queryString: string): ParsedListQuery {
  const result: ParsedListQuery = { unknownOps: [] };
  const filter: ListFilter = {};

  for (const pair of queryString.split('&')) {
    if (!pair) continue;
    const separator = pair.indexOf('=');
    const rawKey = separator === -1 ? pair : pair.slice(0, separator);
    const rawValue = separator === -1 ? '' : pair.slice(separator + 1);

    if (rawKey === 'sort') {
      result.sort = decodeURIComponent(rawValue);
    } else if (rawKey === 'page') {
      result.page = Number(rawValue);
    } else if (rawKey === 'pageSize') {
      result.pageSize = Number(rawValue);
    } else {
      const match = FILTER_KEY.exec(rawKey);
      if (!match) continue;
      const field = decodeURIComponent(match[1]);
      const op = match[2];
      if (!isFilterOp(op)) {
        result.unknownOps.push({ field, op });
        continue;
      }
      const ops = (filter[field] ??= {});
      ops[op] =
        op === 'in' ? rawValue.split(',').map(decodeURIComponent) : decodeURIComponent(rawValue);
    }
  }

  if (Object.keys(filter).length > 0) result.filter = filter;
  return result;
}
