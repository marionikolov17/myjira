import { z } from 'zod';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './query.constants';
import { QueryConfig } from './query.types';

export function paginationSchema(config: QueryConfig) {
  const defaultPageSize = config.defaultPageSize ?? DEFAULT_PAGE_SIZE;
  const maxPageSize = config.maxPageSize ?? MAX_PAGE_SIZE;

  return z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(maxPageSize).default(defaultPageSize),
  });
}
