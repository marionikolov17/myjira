'use client';

import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs';
import { PROJECT_SORT_VALUES, type ProjectSort } from './schemas';

export const PROJECT_FILTER_KEYS = ['creator'] as const;
export type ProjectFilterKey = (typeof PROJECT_FILTER_KEYS)[number];
export type ProjectFilterValues = Record<ProjectFilterKey, string[]>;

const DEFAULT_SORT: ProjectSort = '-updatedAt';
const listParser = parseAsArrayOf(parseAsString).withDefault([]);

const projectFilterParsers = {
  creator: listParser,
  sort: parseAsStringLiteral(PROJECT_SORT_VALUES).withDefault(DEFAULT_SORT),
  page: parseAsInteger.withDefault(1),
};

export function useProjectFilters() {
  const [state, setState] = useQueryStates(projectFilterParsers, { history: 'replace' });

  const values: ProjectFilterValues = {
    creator: state.creator,
  };

  return {
    values,
    sort: state.sort,
    page: Math.max(1, state.page),
    setFilter: (key: ProjectFilterKey, next: string[]) =>
      void setState({ [key]: next.length > 0 ? next : null, page: null }),
    clearFilters: () => void setState({ creator: null, page: null }),
    setSort: (sort: string | null) => {
      const value = (PROJECT_SORT_VALUES as readonly string[]).includes(sort ?? '')
        ? (sort as ProjectSort)
        : null;
      void setState({ sort: value, page: null });
    },
    setPage: (page: number) => void setState({ page: page <= 1 ? null : page }),
  };
}
