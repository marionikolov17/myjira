import { Paginated } from '@/common/query';
import { Issue, IssuePriority, IssueStatus } from './issue.schema';

/*
==============================
Repository Issue Types
==============================
*/
export interface CreateIssueParams {
  projectId: string;
  creatorId: string;
  assigneeId: string;
  title: string;
  description: string;
  priority: IssuePriority;
  status: IssueStatus;
}

export type UpdateIssueParams = Partial<{
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  assigneeId: string;
}>;

/*
==============================
Issue Service Types
==============================
*/
export type ListIssuesResult = Paginated<Issue>;
