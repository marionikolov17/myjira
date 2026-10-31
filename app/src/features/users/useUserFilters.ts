'use client';

import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs';
import { USER_SORT_VALUES, type UserSort } from './schemas';

export const USER_FILTER_KEYS = ['status', 'role'] as const;
export type UserFilterKey = (typeof USER_FILTER_KEYS)[number];
export type UserFilterValues = Record<UserFilterKey, string[]>;

const DEFAULT_SORT: UserSort = 'name';
const listParser = parseAsArrayOf(parseAsString).withDefault([]);

const userFilterParsers = {
  status: listParser,
  role: listParser,
  sort: parseAsStringLiteral(USER_SORT_VALUES).withDefault(DEFAULT_SORT),
  page: parseAsInteger.withDefault(1),
};

export function useUserFilters() {
  const [state, setState] = useQueryStates(userFilterParsers, { history: 'replace' });

  const values: UserFilterValues = {
    status: state.status,
    role: state.role,
  };

  return {
    values,
    sort: state.sort,
    page: Math.max(1, state.page),
    setFilter: (key: UserFilterKey, next: string[]) =>
      void setState({ [key]: next.length > 0 ? next : null, page: null }),
    clearFilters: () => void setState({ status: null, role: null, page: null }),
    setSort: (sort: string | null) => {
      const value = (USER_SORT_VALUES as readonly string[]).includes(sort ?? '')
        ? (sort as UserSort)
        : null;
      void setState({ sort: value, page: null });
    },
    setPage: (page: number) => void setState({ page: page <= 1 ? null : page }),
  };
}
