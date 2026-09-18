import { expect } from '@jest/globals';
import supertest from 'supertest';

interface ExpectedPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  dataLength: number;
}

/**
 * Asserts the canonical paginated list envelope: a 200 with a `data` array and a
 * well-typed `meta.pagination` block. Pass any subset of expectations to pin
 * their concrete values as well.
 *
 * Shared across list endpoints so each per-module spec asserts its own
 * filtering, sorting, and authorization instead of re-checking envelope shape.
 */
export function expectPaginatedEnvelope(
  response: supertest.Response,
  expected: Partial<ExpectedPagination> = {},
): void {
  expect(response.status).toBe(200);
  expect(Array.isArray(response.body.data)).toBe(true);
  expect(response.body.meta?.pagination).toBeDefined();

  const { pagination } = response.body.meta;
  expect(typeof pagination.page).toBe('number');
  expect(typeof pagination.pageSize).toBe('number');
  expect(typeof pagination.totalItems).toBe('number');
  expect(typeof pagination.totalPages).toBe('number');

  if (expected.page !== undefined) {
    expect(pagination.page).toBe(expected.page);
  }
  if (expected.pageSize !== undefined) {
    expect(pagination.pageSize).toBe(expected.pageSize);
  }
  if (expected.totalItems !== undefined) {
    expect(pagination.totalItems).toBe(expected.totalItems);
  }
  if (expected.totalPages !== undefined) {
    expect(pagination.totalPages).toBe(expected.totalPages);
  }
  if (expected.dataLength !== undefined) {
    expect(response.body.data).toHaveLength(expected.dataLength);
  }
}

/**
 * Asserts an authorized list request that matched no rows: a valid envelope with
 * an empty `data` array and zeroed pagination totals.
 */
export function expectEmptyPaginatedEnvelope(response: supertest.Response): void {
  expectPaginatedEnvelope(response, { totalItems: 0, totalPages: 0, dataLength: 0 });
  expect(response.body.data).toEqual([]);
}

/**
 * Asserts that `data` contains exactly the expected ids, regardless of order.
 * Use for filter tests to prove BOTH inclusion (matching rows present) and
 * exclusion (non-matching rows absent).
 */
export function expectDataIds(response: supertest.Response, expectedIds: string[]): void {
  const ids = (response.body.data as { id: string }[]).map((user) => user.id);
  expect(ids).toHaveLength(expectedIds.length);
  expect(ids).toEqual(expect.arrayContaining(expectedIds));
}

/**
 * Asserts that `data` ids appear in exactly the given order. Use for sort tests
 * (including the stable secondary-key tiebreaker).
 */
export function expectDataIdsInOrder(response: supertest.Response, expectedIds: string[]): void {
  const ids = (response.body.data as { id: string }[]).map((user) => user.id);
  expect(ids).toEqual(expectedIds);
}
