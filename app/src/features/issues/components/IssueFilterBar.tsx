'use client';

import { FilterBarShell } from '@/components/common/FilterBarShell';
import type { FilterOption } from '@/components/common/MultiSelectFilter';
import { useProjectMembers } from '@/features/members/queries';
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from '../options';
import type { IssueFilterKey, IssueFilterValues } from '../hooks/useIssueFilters';

const LABELS: Record<IssueFilterKey, string> = {
  status: 'Status',
  priority: 'Priority',
  assignee: 'Assignee',
  creator: 'Creator',
};

type IssueFilterBarProps = {
  projectId: string;
  keys: readonly IssueFilterKey[];
  values: IssueFilterValues;
  onChange: (key: IssueFilterKey, next: string[]) => void;
  onClear: () => void;
};

export function IssueFilterBar({
  projectId,
  keys,
  values,
  onChange,
  onClear,
}: IssueFilterBarProps) {
  const { data: members = [] } = useProjectMembers(projectId);
  const memberOptions: FilterOption[] = members.map((member) => ({
    value: member.user.id,
    label: member.user.name,
  }));

  const optionsFor: Record<IssueFilterKey, FilterOption[]> = {
    status: STATUS_OPTIONS,
    priority: PRIORITY_OPTIONS,
    assignee: memberOptions,
    creator: memberOptions,
  };

  return (
    <FilterBarShell
      ariaLabel="Filter issues"
      keys={keys}
      labels={LABELS}
      optionsFor={optionsFor}
      values={values}
      onChange={onChange}
      onClear={onClear}
    />
  );
}
