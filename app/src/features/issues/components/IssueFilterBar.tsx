'use client';

import { XIcon } from 'lucide-react';
import { MultiSelectFilter, type FilterOption } from '@/components/common/MultiSelectFilter';
import { Button } from '@/components/ui/button';
import { useProjectMembers } from '@/features/members/queries';
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from '../options';
import { UNASSIGNED } from '../schemas';
import type { IssueFilterKey, IssueFilterValues } from '../useIssueFilters';

const LABELS: Record<IssueFilterKey, string> = {
  status: 'Status',
  priority: 'Priority',
  assignee: 'Assignee',
  creator: 'Creator',
};

type IssueFilterBarProps = {
  projectId: string;
  keys: IssueFilterKey[];
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
    assignee: [{ value: UNASSIGNED, label: 'Unassigned' }, ...memberOptions],
    creator: memberOptions,
  };

  const active = keys.some((key) => values[key].length > 0);

  return (
    <div role="group" aria-label="Filter issues" className="flex flex-wrap items-center gap-2">
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
