import { z } from 'zod';

import { QueryConfig } from '@/common/query';

export const SORTABLE_FIELDS = ['createdAt', 'priority'] as const;

/**
 * Representative `QueryConfig` covering the three scalar shapes we care about
 * in the parser tests: string (`status`, `priority`), coerced number
 * (`assigneeCount`), and coerced date (`createdAt`). The per-field operator
 * lists are intentionally different so tests can exercise "operator not
 * permitted for field".
 */
export const testQueryConfig: QueryConfig = {
  sortableFields: [...SORTABLE_FIELDS],
  filterableFields: {
    status: {
      operators: ['eq', 'ne', 'in'],
      schema: z.string().min(1),
    },
    priority: {
      operators: ['eq', 'in'],
      schema: z.string().min(1),
    },
    assigneeCount: {
      operators: ['eq', 'gt', 'gte', 'lt', 'lte', 'in'],
      schema: z.coerce.number().int().nonnegative(),
    },
    createdAt: {
      operators: ['gt', 'gte', 'lt', 'lte'],
      schema: z.coerce.date(),
    },
  },
  defaultPageSize: 10,
  maxPageSize: 100,
};

interface BuildRawQueryParams {
  page?: string;
  pageSize?: string;
  sort?: string;
  filter?: Record<string, unknown>;
}

/**
 * Builds a raw query object shaped like what `qs` produces from an Express
 * request query string. Use it in tests to feed the parser: pagination and
 * sort arrive as strings, filters arrive as a nested plain object.
 */
export function buildRawQuery(params: BuildRawQueryParams = {}): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (params.page !== undefined) query['page'] = params.page;
  if (params.pageSize !== undefined) query['pageSize'] = params.pageSize;
  if (params.sort !== undefined) query['sort'] = params.sort;
  if (params.filter !== undefined) query['filter'] = params.filter;
  return query;
}

/**
 * Builds a flat filter value: `filter[field]=value` in the raw request.
 */
export function buildFlatFilter(field: string, value: string): Record<string, unknown> {
  return { [field]: value };
}

/**
 * Builds an `[operator]`-nested filter value:
 * `filter[field][operator]=value` in the raw request.
 */
export function buildOperatorFilter(
  field: string,
  operator: string,
  value: string,
): Record<string, unknown> {
  return { [field]: { [operator]: value } };
}

/**
 * Builds a comma-separated `in` filter value:
 * `filter[field][in]=v1,v2` in the raw request.
 */
export function buildInFilter(field: string, values: string[]): Record<string, unknown> {
  return { [field]: { in: values.join(',') } };
}
