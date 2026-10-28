import { z } from 'zod';

export type Envelope<T> = { data: T };

export type Collection<T> = { data: T[] };

export type Pagination = {
  pageNumber: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type Paginated<T> = {
  data: T[];
  meta: { pagination: Pagination };
};

export const FILTER_OPS = ['eq', 'ne', 'in', 'gt', 'gte', 'lt', 'lte'] as const;
export type FilterOp = (typeof FILTER_OPS)[number];
export type FilterValue = string | string[];
/** Filter value that matches a null field, e.g. `filter[assigneeId][in]=null`. */
export const NULL_FILTER_VALUE = 'null';
export type ListFilter = Record<string, Partial<Record<FilterOp, FilterValue>>>;

export type ListQuery = {
  page?: number;
  pageSize?: number;
  sort?: string;
  filter?: ListFilter;
};

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const uuidSchema = z.uuid();
export const timestampSchema = z.iso.datetime();

export const userRefSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
});
export type UserRef = z.infer<typeof userRefSchema>;
