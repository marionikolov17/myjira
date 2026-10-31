import { Badge } from '@/components/ui/badge';
import type { IssueStatus } from '@/lib/api/schemas';
import { ISSUE_STATUS_LABELS, STATUS_ICONS } from '@/lib/labels/issues';

const STATUS_VARIANTS: Record<IssueStatus, 'outline' | 'secondary' | 'default'> = {
  ToDo: 'outline',
  InProgress: 'secondary',
  Done: 'default',
};

export function StatusIcon({ status, className }: { status: IssueStatus; className?: string }) {
  const Icon = STATUS_ICONS[status];
  return <Icon aria-hidden="true" className={className} />;
}

export function StatusBadge({ status }: { status: IssueStatus }) {
  const Icon = STATUS_ICONS[status];
  return (
    <Badge variant={STATUS_VARIANTS[status]}>
      <Icon data-icon="inline-start" aria-hidden="true" />
      {ISSUE_STATUS_LABELS[status]}
    </Badge>
  );
}
