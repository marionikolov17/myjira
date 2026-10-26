import { z } from 'zod';

export enum IssueStatus {
  ToDo = 'ToDo',
  InProgress = 'InProgress',
  Done = 'Done',
}

export enum IssuePriority {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
}

export const IssueStatusSchema = z.enum(Object.values(IssueStatus));
export const IssuePrioritySchema = z.enum(Object.values(IssuePriority));

export const IssueSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string(),
  status: IssueStatusSchema,
  priority: IssuePrioritySchema,
  projectId: z.uuid(),
  creator: z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
  }),
  assignee: z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
  }),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Issue = z.infer<typeof IssueSchema>;

export const CreateIssueRequestParamsSchema = z.strictObject({
  title: z.string().min(1),
  description: z.string().min(1),
  priority: IssuePrioritySchema.optional(),
  assigneeId: z.uuid().optional(),
});
export type CreateIssueRequestParams = z.infer<typeof CreateIssueRequestParamsSchema>;

export const UpdateIssueRequestParamsSchema = z
  .strictObject({
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    status: IssueStatusSchema.optional(),
    priority: IssuePrioritySchema.optional(),
    assigneeId: z.uuid().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });
export type UpdateIssueRequestParams = z.infer<typeof UpdateIssueRequestParamsSchema>;
