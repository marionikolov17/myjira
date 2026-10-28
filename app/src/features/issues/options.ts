import { PRIORITY_ICONS } from '@/components/common/PriorityBadge';
import { STATUS_ICONS } from '@/components/common/StatusBadge';
import {
  ISSUE_PRIORITIES,
  ISSUE_STATUS_LABELS,
  ISSUE_STATUSES,
  type IssuePriority,
  type IssueStatus,
} from '@/lib/api/schemas';
import type { SelectOption } from '@/components/common/OptionSelect';

export const STATUS_OPTIONS: SelectOption<IssueStatus>[] = ISSUE_STATUSES.map((status) => ({
  value: status,
  label: ISSUE_STATUS_LABELS[status],
  icon: STATUS_ICONS[status],
}));

export const PRIORITY_OPTIONS: SelectOption<IssuePriority>[] = [...ISSUE_PRIORITIES]
  .reverse()
  .map((priority) => ({
    value: priority,
    label: priority,
    icon: PRIORITY_ICONS[priority],
  }));
