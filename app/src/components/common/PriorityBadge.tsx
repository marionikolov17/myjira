import { SignalHighIcon, SignalLowIcon, SignalMediumIcon, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { IssuePriority } from '@/lib/api/schemas';
import { cn } from '@/lib/utils';

export const PRIORITY_ICONS: Record<IssuePriority, LucideIcon> = {
  Low: SignalLowIcon,
  Medium: SignalMediumIcon,
  High: SignalHighIcon,
};

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
