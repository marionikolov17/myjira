import { prisma } from '@/common/lib/prisma';
import { IssuePriority, IssueStatus } from '@/modules/issues';

export interface SeededIssue {
  id: string;
  projectId: string;
  creatorId: string;
  assigneeId: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
}

/**
 * Seeds an issue row directly via Prisma (bypassing the controller/service).
 * Shared across any integration suite that needs issues as upstream state
 * (e.g. the issues suite itself, plus the comments suite).
 */
export async function seedIssue(params: {
  projectId: string;
  creatorId: string;
  assigneeId: string;
  title: string;
  description: string;
  status?: IssueStatus;
  priority?: IssuePriority;
}): Promise<SeededIssue> {
  const row = await prisma.issue.create({
    data: {
      projectId: params.projectId,
      creatorId: params.creatorId,
      assigneeId: params.assigneeId,
      title: params.title,
      description: params.description,
      status: params.status ?? IssueStatus.ToDo,
      priority: params.priority ?? IssuePriority.Medium,
    },
    select: {
      id: true,
      projectId: true,
      creatorId: true,
      assigneeId: true,
      title: true,
      description: true,
      status: true,
      priority: true,
    },
  });
  return {
    id: row.id,
    projectId: row.projectId,
    creatorId: row.creatorId,
    assigneeId: row.assigneeId,
    title: row.title,
    description: row.description,
    status: row.status as IssueStatus,
    priority: row.priority as IssuePriority,
  };
}

/**
 * Wipes the issue graph the issues/comments integration suites own:
 * `issues` (and cascade-dependent children like comments/subtasks), plus the
 * surrounding `project_members` and `projects`. Shared across any module whose
 * test owns the same slice of DB state.
 */
export async function wipeIssueGraph(): Promise<void> {
  await prisma.issue.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
}
