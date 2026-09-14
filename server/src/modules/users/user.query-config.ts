import { z } from 'zod';
import { UserStatus } from '@/generated/prisma/enums';
import { QueryConfig } from '@/common/query';

export const usersQueryConfig: QueryConfig = {
  sortableFields: ['name', 'email', 'createdAt', 'updatedAt'],
  defaultPageSize: 10,
  maxPageSize: 100,
  filterableFields: {
    name: {
      operators: ['eq', 'ne', 'in'],
      schema: z.string().min(1),
    },
    email: {
      operators: ['eq', 'ne', 'in'],
      schema: z.string().email(),
    },
    workspaceRoleId: {
      operators: ['eq', 'ne', 'in'],
      schema: z.string().uuid(),
    },
    status: {
      operators: ['eq', 'ne', 'in'],
      schema: z.nativeEnum(UserStatus),
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
