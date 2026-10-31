'use client';

import { FilterBarShell } from '@/components/common/FilterBarShell';
import type { FilterOption } from '@/components/common/MultiSelectFilter';
import { useWorkspaceRoles } from '@/features/roles/queries';
import { USER_STATUS_OPTIONS } from '../options';
import type { UserFilterKey, UserFilterValues } from '../useUserFilters';

const LABELS: Record<UserFilterKey, string> = {
  status: 'Status',
  role: 'Role',
};

type UserFilterBarProps = {
  keys: readonly UserFilterKey[];
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

  return (
    <FilterBarShell
      ariaLabel="Filter users"
      keys={keys}
      labels={LABELS}
      optionsFor={optionsFor}
      values={values}
      onChange={onChange}
      onClear={onClear}
    />
  );
}
