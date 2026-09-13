import { describe, expect, it } from '@jest/globals';

import { FilterOperator, QueryOptions, toPrismaFindArgs } from '@/common/query';

function buildOptions(overrides: Partial<QueryOptions> = {}): QueryOptions {
  return {
    pagination: { page: 1, pageSize: 10 },
    sort: [],
    filters: [],
    ...overrides,
  };
}

describe('toPrismaFindArgs', () => {
  it('should derive skip and take from page and pageSize', () => {
    const args = toPrismaFindArgs(buildOptions({ pagination: { page: 3, pageSize: 10 } }));

    expect(args.skip).toBe(20);
    expect(args.take).toBe(10);
  });

  it('should skip zero on the first page', () => {
    const args = toPrismaFindArgs(buildOptions({ pagination: { page: 1, pageSize: 25 } }));

    expect(args.skip).toBe(0);
    expect(args.take).toBe(25);
  });

  it('should preserve sort order and direction', () => {
    const args = toPrismaFindArgs(
      buildOptions({
        sort: [
          { field: 'priority', direction: 'asc' },
          { field: 'createdAt', direction: 'desc' },
        ],
      }),
    );

    expect(args.orderBy).toEqual([{ priority: 'asc' }, { createdAt: 'desc' }]);
  });

  it.each([
    { case: 'eq', operator: 'eq' as FilterOperator, keyword: 'equals' },
    { case: 'ne', operator: 'ne' as FilterOperator, keyword: 'not' },
    { case: 'gt', operator: 'gt' as FilterOperator, keyword: 'gt' },
    { case: 'gte', operator: 'gte' as FilterOperator, keyword: 'gte' },
    { case: 'lt', operator: 'lt' as FilterOperator, keyword: 'lt' },
    { case: 'lte', operator: 'lte' as FilterOperator, keyword: 'lte' },
    { case: 'in', operator: 'in' as FilterOperator, keyword: 'in' },
  ])('should map the $case operator to Prisma keyword "$keyword"', ({ operator, keyword }) => {
    const value = operator === 'in' ? ['a', 'b'] : 'value';
    const args = toPrismaFindArgs(
      buildOptions({ filters: [{ field: 'status', operator, value }] }),
    );

    expect(args.where).toEqual({ status: { [keyword]: value } });
  });

  it('should merge multiple filters on the same field into a single where entry', () => {
    const args = toPrismaFindArgs(
      buildOptions({
        filters: [
          { field: 'createdAt', operator: 'gte', value: new Date('2025-01-01') },
          { field: 'createdAt', operator: 'lte', value: new Date('2025-12-31') },
        ],
      }),
    );

    expect(args.where).toEqual({
      createdAt: {
        gte: new Date('2025-01-01'),
        lte: new Date('2025-12-31'),
      },
    });
  });
});
