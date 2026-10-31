import type { SelectOption } from '@/components/common/OptionSelect';
import {
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  type IssuePriority,
  type IssueStatus,
} from '@/lib/api/schemas';
import { ISSUE_STATUS_LABELS, PRIORITY_ICONS, STATUS_ICONS } from '@/lib/labels/issues';

export { ISSUE_STATUS_LABELS } from '@/lib/labels/issues';

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
