import { FilterOperator, QueryFilter, QueryOptions, QuerySort } from './query.types';

export interface PrismaFindArgs {
  skip: number;
  take: number;
  orderBy: Record<string, 'asc' | 'desc'>[];
  where: Record<string, Record<string, unknown>>;
}

const OPERATOR_TO_PRISMA_KEYWORD: Record<FilterOperator, string> = {
  eq: 'equals',
  ne: 'not',
  gt: 'gt',
  gte: 'gte',
  lt: 'lt',
  lte: 'lte',
  in: 'in',
};

export function toPrismaFindArgs(options: QueryOptions): PrismaFindArgs {
  const { page, pageSize } = options.pagination;
  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: buildOrderBy(options.sort),
    where: buildWhere(options.filters),
  };
}

function buildOrderBy(sort: QuerySort[]): Record<string, 'asc' | 'desc'>[] {
  return sort.map(({ field, direction }) => ({ [field]: direction }));
}

function buildWhere(filters: QueryFilter[]): Record<string, Record<string, unknown>> {
  const where: Record<string, Record<string, unknown>> = {};
  for (const { field, operator, value } of filters) {
    const keyword = OPERATOR_TO_PRISMA_KEYWORD[operator];
    const existing = where[field] ?? {};
    existing[keyword] = value;
    where[field] = existing;
  }
  return where;
}
