import { z } from 'zod'
import { createIssueInputSchema, ISSUE_PRIORITIES, ISSUE_STATUSES } from '@/lib/api/schemas'

export {
  createIssueInputSchema,
  updateIssueInputSchema,
  type CreateIssueInput,
  type UpdateIssueInput,
} from '@/lib/api/schemas'

/** Form shape for the create dialog: same contract, with concrete defaults for the selects. */
export const createIssueFormSchema = createIssueInputSchema.extend({
  description: z.string().max(5000, 'Description must be 5000 characters or fewer'),
  status: z.enum(ISSUE_STATUSES),
  priority: z.enum(ISSUE_PRIORITIES),
  assigneeId: z.uuid('Select a valid assignee').nullable(),
})
export type CreateIssueForm = z.infer<typeof createIssueFormSchema>

export const ISSUE_SORT_FIELDS = ['title', 'status', 'priority', 'updatedAt', 'createdAt'] as const
export const ISSUES_PAGE_SIZE = 15
export const UNASSIGNED = 'unassigned'
