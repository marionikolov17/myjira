import { Badge } from '@/components/ui/badge';
import type { IssuePriority } from '@/lib/api/schemas';
import { PRIORITY_ICONS } from '@/lib/labels/issues';
import { cn } from '@/lib/utils';

const PRIORITY_VARIANTS: Record<IssuePriority, 'outline' | 'secondary' | 'destructive'> = {
  Low: 'outline',
  Medium: 'secondary',
  High: 'destructive',
};

export function PriorityIcon({
  priority,
  className,
}: {
  priority: IssuePriority;
  className?: string;
}) {
  const Icon = PRIORITY_ICONS[priority];
  return (
    <span className="inline-flex" title={`${priority} priority`}>
      <Icon
        aria-hidden="true"
        className={cn('size-4', priority === 'High' && 'text-destructive', className)}
      />
      <span className="sr-only">{`${priority} priority`}</span>
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: IssuePriority }) {
  const Icon = PRIORITY_ICONS[priority];
  return (
    <Badge variant={PRIORITY_VARIANTS[priority]}>
      <Icon data-icon="inline-start" aria-hidden="true" />
      {priority}
    </Badge>
  );
}
