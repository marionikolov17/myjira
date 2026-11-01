'use client';

import { parseAsArrayOf, parseAsString, useQueryStates } from 'nuqs';

const listParser = parseAsArrayOf(parseAsString).withDefault([]);

export type MultiSelectFiltersConfig<TFilterKey extends string> = {
  filterKeys: readonly TFilterKey[];
  /** Maps logical filter keys to distinct URL query param names. */
  urlKeys: Record<TFilterKey, string>;
};

export type MultiSelectFiltersApi<TFilterKey extends string> = {
  values: Record<TFilterKey, string[]>;
  setFilter: (key: TFilterKey, next: string[]) => void;
  clearFilters: () => void;
};

type MultiSelectSetValues = Partial<Record<string, string[] | null>>;

/** URL multi-select filters without sort/page (e.g. board-only params). */
export function createMultiSelectFiltersHook<TFilterKey extends string>(
  config: MultiSelectFiltersConfig<TFilterKey>,
) {
  const { filterKeys, urlKeys } = config;

  const parsers = Object.fromEntries(filterKeys.map((key) => [urlKeys[key], listParser])) as Record<
    string,
    typeof listParser
  >;

  return function useMultiSelectFilters(): MultiSelectFiltersApi<TFilterKey> {
    const [state, setState] = useQueryStates(parsers, { history: 'replace' });

    const values = Object.fromEntries(
      filterKeys.map((key) => [key, (state[urlKeys[key]] as string[] | undefined) ?? []]),
    ) as Record<TFilterKey, string[]>;

    const setValues = (patch: MultiSelectSetValues) =>
      void setState(patch as Parameters<typeof setState>[0]);

    return {
      values,
      setFilter: (key, next) => setValues({ [urlKeys[key]]: next.length > 0 ? next : null }),
      clearFilters: () =>
        setValues(Object.fromEntries(filterKeys.map((key) => [urlKeys[key], null]))),
    };
  };
}
