'use client';

import { XIcon } from 'lucide-react';
import { MultiSelectFilter, type FilterOption } from '@/components/common/MultiSelectFilter';
import { Button } from '@/components/ui/button';
import { useWorkspaceRoles } from '@/features/roles/queries';
import { USER_STATUS_OPTIONS } from '../options';
import type { UserFilterKey, UserFilterValues } from '../useUserFilters';

const LABELS: Record<UserFilterKey, string> = {
  status: 'Status',
  role: 'Role',
};

type UserFilterBarProps = {
  keys: UserFilterKey[];
  values: UserFilterValues;
  onChange: (key: UserFilterKey, next: string[]) => void;
  onClear: () => void;
};

export function UserFilterBar({ keys, values, onChange, onClear }: UserFilterBarProps) {
  const workspaceRoles = useWorkspaceRoles();
  const roleOptions: FilterOption[] = (workspaceRoles.roles ?? []).map((role) => ({
    value: role.id,
    label: role.name,
  }));

  const optionsFor: Record<UserFilterKey, FilterOption[]> = {
    status: USER_STATUS_OPTIONS,
    role: roleOptions,
  };

  const active = keys.some((key) => values[key].length > 0);

  return (
    <div role="group" aria-label="Filter users" className="flex flex-wrap items-center gap-2">
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
