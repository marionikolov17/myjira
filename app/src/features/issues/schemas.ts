import { z } from 'zod';
import { createIssueInputSchema, ISSUE_PRIORITIES } from '@/lib/api/schemas';

export {
  createIssueInputSchema,
  updateIssueInputSchema,
  type CreateIssueInput,
  type UpdateIssueInput,
} from '@/lib/api/schemas';

/**
 * Form shape for the create dialog. Mirrors the API contract (no `status` field; the server
 * always starts new issues in `ToDo`) and requires concrete defaults for the selects so the
 * form always submits a valid payload.
 */
export const createIssueFormSchema = createIssueInputSchema.extend({
  priority: z.enum(ISSUE_PRIORITIES),
  assigneeId: z.uuid('Select a valid assignee'),
});
export type CreateIssueForm = z.infer<typeof createIssueFormSchema>;

export const ISSUE_SORT_FIELDS = [
  'title',
  '-title',
  'status',
  '-status',
  'priority',
  '-priority',
  'updatedAt',
  '-updatedAt',
  'createdAt',
  '-createdAt',
] as const;
export type IssueSortField = (typeof ISSUE_SORT_FIELDS)[number];

export const ISSUES_PAGE_SIZE = 15;
