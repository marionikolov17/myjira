import { describe, expect, it } from '@jest/globals';

import { buildPaginationMeta } from '@/common/query';

describe('buildPaginationMeta', () => {
  it('should report the exact number of pages when totalItems divides evenly by pageSize', () => {
    expect(buildPaginationMeta(1, 10, 120)).toEqual({
      page: 1,
      pageSize: 10,
      totalItems: 120,
      totalPages: 12,
    });
  });

  it('should round up when the final page is partial', () => {
    expect(buildPaginationMeta(1, 10, 25)).toEqual({
      page: 1,
      pageSize: 10,
      totalItems: 25,
      totalPages: 3,
    });
  });

  it('should report zero total pages when there are no items', () => {
    expect(buildPaginationMeta(1, 10, 0)).toEqual({
      page: 1,
      pageSize: 10,
      totalItems: 0,
      totalPages: 0,
    });
  });
});
