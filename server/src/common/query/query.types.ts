import { ZodType } from 'zod';

export interface QueryOptions {
  pagination: QueryPagination;
  sort: QuerySort[];
  filters: QueryFilter[];
}

export interface QueryPagination {
  page: number;
  pageSize: number;
}

export interface QuerySort {
  field: string;
  direction: SortDirection;
}

export type SortDirection = 'asc' | 'desc';

export interface QueryFilter {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

export type FilterOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';

export interface QueryConfig {
  sortableFields: string[];
  filterableFields: Record<string, FilterFieldConfig>;
  defaultPageSize?: number;
  maxPageSize?: number;
}

export interface FilterFieldConfig {
  operators: FilterOperator[];
  schema: ZodType;
}
