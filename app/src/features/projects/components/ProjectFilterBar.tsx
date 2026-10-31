'use client';

import { FilterBarShell } from '@/components/common/FilterBarShell';
import type { FilterOption } from '@/components/common/MultiSelectFilter';
import { useUsers } from '@/features/users/queries';
import type { ProjectFilterKey, ProjectFilterValues } from '../hooks/useProjectFilters';

const CREATOR_PAGE_SIZE = 100;

const LABELS: Record<ProjectFilterKey, string> = {
  creator: 'Creator',
};

type ProjectFilterBarProps = {
  keys: readonly ProjectFilterKey[];
  values: ProjectFilterValues;
  onChange: (key: ProjectFilterKey, next: string[]) => void;
  onClear: () => void;
};

export function ProjectFilterBar({ keys, values, onChange, onClear }: ProjectFilterBarProps) {
  const { data: users } = useUsers({ pageSize: CREATOR_PAGE_SIZE, sort: 'name' });
  const creatorOptions: FilterOption[] = (users?.data ?? []).map((user) => ({
    value: user.id,
    label: user.name,
  }));

  const optionsFor: Record<ProjectFilterKey, FilterOption[]> = {
    creator: creatorOptions,
  };

  return (
    <FilterBarShell
      ariaLabel="Filter projects"
      keys={keys}
      labels={LABELS}
      optionsFor={optionsFor}
      values={values}
      onChange={onChange}
      onClear={onClear}
    />
  );
}
