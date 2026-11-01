import { z } from 'zod';
import { timestampSchema, userRefSchema } from './common';

export const ISSUE_STATUSES = ['ToDo', 'InProgress', 'Done'] as const;
export const issueStatusSchema = z.enum(ISSUE_STATUSES);
export type IssueStatus = z.infer<typeof issueStatusSchema>;

/** Statuses treated as open for dashboards and “my issues” queries. */
export const OPEN_ISSUE_STATUSES = ['ToDo', 'InProgress'] as const satisfies readonly IssueStatus[];

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
  assignee: userRefSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type Issue = z.infer<typeof issueSchema>;

export const ISSUE_TITLE_MAX_LENGTH = 200;
export const ISSUE_DESCRIPTION_MAX_LENGTH = 5000;

export const issueTitle = z
  .string()
  .trim()
  .min(1, 'Title is required')
  .max(ISSUE_TITLE_MAX_LENGTH, `Title must be ${ISSUE_TITLE_MAX_LENGTH} characters or fewer`);
export const issueDescription = z
  .string()
  .trim()
  .min(1, 'Description is required')
  .max(
    ISSUE_DESCRIPTION_MAX_LENGTH,
    `Description must be ${ISSUE_DESCRIPTION_MAX_LENGTH} characters or fewer`,
  );

export const createIssueInputSchema = z.object({
  title: issueTitle,
  description: issueDescription,
  priority: issuePrioritySchema.optional(),
  assigneeId: z.uuid('Select a valid assignee').optional(),
});
export type CreateIssueInput = z.infer<typeof createIssueInputSchema>;

export const updateIssueInputSchema = z.object({
  title: issueTitle.optional(),
  description: issueDescription.optional(),
  status: issueStatusSchema.optional(),
  priority: issuePrioritySchema.optional(),
  assigneeId: z.uuid('Select a valid assignee').optional(),
});
export type UpdateIssueInput = z.infer<typeof updateIssueInputSchema>;
