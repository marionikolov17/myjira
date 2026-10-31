export {
  createIssueInputSchema,
  updateIssueInputSchema,
  type CreateIssueInput,
  type UpdateIssueInput,
} from '@/lib/api/schemas';

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
export const ISSUE_SORT_VALUES = ISSUE_SORT_FIELDS.map((field) => field) as IssueSortField[];

export const ISSUES_PAGE_SIZE = 15;
