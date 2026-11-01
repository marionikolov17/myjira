import { CircleCheckIcon, CircleDashedIcon, CircleDotIcon, type LucideIcon } from 'lucide-react';
import { SignalHighIcon, SignalLowIcon, SignalMediumIcon } from 'lucide-react';
import type { IssuePriority, IssueStatus } from '@/lib/api/schemas';

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  ToDo: 'To do',
  InProgress: 'In progress',
  Done: 'Done',
};

export const STATUS_ICONS: Record<IssueStatus, LucideIcon> = {
  ToDo: CircleDashedIcon,
  InProgress: CircleDotIcon,
  Done: CircleCheckIcon,
};

export const PRIORITY_ICONS: Record<IssuePriority, LucideIcon> = {
  Low: SignalLowIcon,
  Medium: SignalMediumIcon,
  High: SignalHighIcon,
};
