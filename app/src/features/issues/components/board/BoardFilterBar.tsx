'use client';

import { FilterBarShell } from '@/components/common/FilterBarShell';
import type { FilterOption } from '@/components/common/MultiSelectFilter';
import { useProjectMembers } from '@/features/members/queries';
import { PRIORITY_OPTIONS } from '../../options';
import type { BoardFilterKey, BoardFilterValues } from '../../hooks/useBoardFilters';

const LABELS: Record<BoardFilterKey, string> = {
  priority: 'Priority',
  assignee: 'Assignee',
};

type BoardFilterBarProps = {
  projectId: string;
  values: BoardFilterValues;
  onChange: (key: BoardFilterKey, next: string[]) => void;
  onClear: () => void;
};

export function BoardFilterBar({ projectId, values, onChange, onClear }: BoardFilterBarProps) {
  const { data: members = [] } = useProjectMembers(projectId);
  const memberOptions: FilterOption[] = members.map((member) => ({
    value: member.user.id,
    label: member.user.name,
  }));

  const optionsFor: Record<BoardFilterKey, FilterOption[]> = {
    priority: PRIORITY_OPTIONS,
    assignee: memberOptions,
  };

  return (
    <FilterBarShell
      ariaLabel="Filter board"
      keys={['priority', 'assignee']}
      labels={LABELS}
      optionsFor={optionsFor}
      values={values}
      onChange={onChange}
      onClear={onClear}
    />
  );
}
