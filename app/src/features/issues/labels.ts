import type { IssueStatus } from '@/lib/api/schemas';

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  ToDo: 'To do',
  InProgress: 'In progress',
  Done: 'Done',
};
