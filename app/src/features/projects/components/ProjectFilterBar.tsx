'use client';

import { XIcon } from 'lucide-react';
import { MultiSelectFilter, type FilterOption } from '@/components/common/MultiSelectFilter';
import { Button } from '@/components/ui/button';
import { useUsers } from '@/features/users/queries';
import type { ProjectFilterKey, ProjectFilterValues } from '../useProjectFilters';

const CREATOR_PAGE_SIZE = 100;

const LABELS: Record<ProjectFilterKey, string> = {
  creator: 'Creator',
};

type ProjectFilterBarProps = {
  keys: ProjectFilterKey[];
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

  const active = keys.some((key) => values[key].length > 0);

  return (
    <div role="group" aria-label="Filter projects" className="flex flex-wrap items-center gap-2">
      {keys.map((key) => (
        <MultiSelectFilter
          key={key}
          label={LABELS[key]}
          options={optionsFor[key]}
          selected={values[key]}
          onChange={(next) => onChange(key, next)}
        />
      ))}
      {active && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <XIcon data-icon="inline-start" />
          Clear filters
        </Button>
      )}
    </div>
  );
}
