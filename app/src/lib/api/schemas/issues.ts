import { z } from 'zod';
import { timestampSchema, userRefSchema } from './common';

export const ISSUE_STATUSES = ['ToDo', 'InProgress', 'Done'] as const;
export const issueStatusSchema = z.enum(ISSUE_STATUSES);
export type IssueStatus = z.infer<typeof issueStatusSchema>;

export const ISSUE_PRIORITIES = ['Low', 'Medium', 'High'] as const;
export const issuePrioritySchema = z.enum(ISSUE_PRIORITIES);
export type IssuePriority = z.infer<typeof issuePrioritySchema>;

export const issueSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string(),
  status: issueStatusSchema,
  priority: issuePrioritySchema,
  projectId: z.uuid(),
  creator: userRefSchema,
  assignee: userRefSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Issue = z.infer<typeof issueSchema>;

const issueTitle = z
  .string()
  .trim()
  .min(1, 'Title is required')
  .max(200, 'Title must be 200 characters or fewer');
const issueDescription = z.string().max(5000, 'Description must be 5000 characters or fewer');

export const createIssueInputSchema = z.object({
  title: issueTitle,
  description: issueDescription.optional(),
  status: issueStatusSchema.optional(),
  priority: issuePrioritySchema.optional(),
  assigneeId: z.uuid('Select a valid assignee').nullable().optional(),
});
export type CreateIssueInput = z.infer<typeof createIssueInputSchema>;

export const updateIssueInputSchema = z.object({
  title: issueTitle.optional(),
  description: issueDescription.optional(),
  status: issueStatusSchema.optional(),
  priority: issuePrioritySchema.optional(),
  assigneeId: z.uuid('Select a valid assignee').nullable().optional(),
});
export type UpdateIssueInput = z.infer<typeof updateIssueInputSchema>;

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  ToDo: 'To do',
  InProgress: 'In progress',
  Done: 'Done',
};
