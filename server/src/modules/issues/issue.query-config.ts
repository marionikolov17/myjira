import { z } from 'zod';
import { QueryConfig } from '@/common/query';
import { IssuePrioritySchema, IssueStatusSchema } from './issue.schema';

export const issuesQueryConfig: QueryConfig = {
  sortableFields: ['createdAt', 'updatedAt', 'title', 'priority', 'status'],
  defaultPageSize: 10,
  maxPageSize: 100,
  filterableFields: {
    status: {
      operators: ['eq', 'ne', 'in'],
      schema: IssueStatusSchema,
    },
    priority: {
      operators: ['eq', 'ne', 'in'],
      schema: IssuePrioritySchema,
    },
    assigneeId: {
      operators: ['eq', 'ne', 'in'],
      schema: z.string().uuid(),
    },
    creatorId: {
      operators: ['eq', 'ne', 'in'],
      schema: z.string().uuid(),
    },
    createdAt: {
      operators: ['eq', 'gt', 'gte', 'lt', 'lte'],
      schema: z.coerce.date(),
    },
    updatedAt: {
      operators: ['eq', 'gt', 'gte', 'lt', 'lte'],
      schema: z.coerce.date(),
    },
  },
};
