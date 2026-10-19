import { z } from 'zod';
import { QueryConfig } from '@/common/query';

export const projectsQueryConfig: QueryConfig = {
  sortableFields: ['name', 'createdAt', 'updatedAt'],
  defaultPageSize: 10,
  maxPageSize: 100,
  filterableFields: {
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
