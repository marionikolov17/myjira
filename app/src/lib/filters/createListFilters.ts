'use client';

import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs';
import type { ListFilter, ListQuery } from '@/lib/api/schemas';

const listParser = parseAsArrayOf(parseAsString).withDefault([]);

export type ListFiltersConfig<TFilterKey extends string, TSort extends string> = {
  filterKeys: readonly TFilterKey[];
  sortValues: readonly [TSort, ...TSort[]];
  defaultSort: TSort;
};

export type ListFiltersApi<TFilterKey extends string, TSort extends string> = {
  values: Record<TFilterKey, string[]>;
  sort: TSort;
  page: number;
  setFilter: (key: TFilterKey, next: string[]) => void;
  clearFilters: () => void;
  setSort: (sort: string | null) => void;
  setPage: (page: number) => void;
};

/** Shared nuqs list-filter hook factory (filter keys + sort + page). */
export function createListFiltersHook<TFilterKey extends string, TSort extends string>(
  config: ListFiltersConfig<TFilterKey, TSort>,
) {
  const { filterKeys, sortValues, defaultSort } = config;

  const parsers = {
    ...(Object.fromEntries(filterKeys.map((key) => [key, listParser])) as Record<
      TFilterKey,
      typeof listParser
    >),
    sort: parseAsStringLiteral(sortValues).withDefault(defaultSort),
    page: parseAsInteger.withDefault(1),
  };

  return function useListFilters(): ListFiltersApi<TFilterKey, TSort> {
    const [state, setState] = useQueryStates(parsers, { history: 'replace' });

    const values = {} as Record<TFilterKey, string[]>;
    for (const key of filterKeys) {
      const raw = state[key as keyof typeof state];
      values[key] = Array.isArray(raw) ? (raw as string[]) : [];
    }

    // Dynamic filter keys prevent a fully inferred setState payload; narrow at the boundary.
    type SetStateArg = Parameters<typeof setState>[0];
    const setValues = (patch: SetStateArg) => void setState(patch);

    return {
      values,
      sort: state.sort as TSort,
      page: Math.max(1, Number(state.page) || 1),
      setFilter: (key, next) =>
        setValues({ [key]: next.length > 0 ? next : null, page: null } as SetStateArg),
      clearFilters: () =>
        setValues(
          Object.fromEntries([
            ...filterKeys.map((key) => [key, null]),
            ['page', null],
          ]) as SetStateArg,
        ),
      setSort: (sort) => {
        const value = (sortValues as readonly string[]).includes(sort ?? '')
          ? (sort as TSort)
          : null;
        setValues({ sort: value, page: null } as SetStateArg);
      },
      setPage: (page) => setValues({ page: page <= 1 ? null : page } as SetStateArg),
    };
  };
}

/** Build `{ field: { in: values } }` when the array is non-empty. */
export function inFilter(field: string, values: string[]): ListFilter | undefined {
  if (values.length === 0) return undefined;
  return { [field]: { in: values } };
}

/** Merge partial filters; returns undefined when nothing is set. */
export function mergeFilters(...parts: Array<ListFilter | undefined>): ListFilter | undefined {
  const merged: ListFilter = {};
  for (const part of parts) {
    if (part) Object.assign(merged, part);
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

export function toListQuery(args: {
  page: number;
  pageSize: number;
  sort: string;
  filter?: ListFilter;
}): ListQuery {
  return {
    page: args.page,
    pageSize: args.pageSize,
    sort: args.sort,
    filter: args.filter,
  };
}
