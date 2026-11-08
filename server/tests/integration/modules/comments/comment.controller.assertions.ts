import { expect } from '@jest/globals';
import supertest from 'supertest';

import { prisma } from '@/common/lib/prisma';

export interface ExpectedCommentResource {
  /** When set, the comment `id` must match exactly. */
  id?: string;
  body: string;
  issueId: string;
  creator: { id: string; name: string; email: string };
}

function expectedCommentShape(expected: ExpectedCommentResource) {
  return {
    id: expected.id ?? expect.any(String),
    body: expected.body,
    issueId: expected.issueId,
    creator: {
      id: expected.creator.id,
      name: expected.creator.name,
      email: expected.creator.email,
    },
    createdAt: expect.any(String),
    updatedAt: expect.any(String),
  };
}

/**
 * Asserts the response body carries exactly the comment shape, with no leaked
 * scalar `creatorId` field.
 */
export function expectCommentResource(
  response: supertest.Response,
  status: 200 | 201,
  expected: ExpectedCommentResource,
): void {
  expect(response.status).toBe(status);
  expect(response.body.data).toEqual(expectedCommentShape(expected));
  expect(response.body.data.creatorId).toBeUndefined();
}

/**
 * Asserts a comment list envelope: `{ data: [...] }` with NO `meta` object,
 * and each entry having the exact expanded shape in the given order.
 */
export function expectCommentListResponse(
  response: supertest.Response,
  expectedEntries: ExpectedCommentResource[],
): void {
  expect(response.status).toBe(200);
  expect(response.body.meta).toBeUndefined();

  const data = response.body.data;
  expect(Array.isArray(data)).toBe(true);
  expect(data).toHaveLength(expectedEntries.length);

  expectedEntries.forEach((expected, i) => {
    expect(data[i]).toEqual(expectedCommentShape(expected));
    expect(data[i].creatorId).toBeUndefined();
  });
}

/**
 * Asserts a 204 No Content response with an empty body.
 */
export function expectNoContentResponse(response: supertest.Response): void {
  expect(response.status).toBe(204);
  expect(response.body).toEqual({});
}

export async function expectCommentPersisted(
  commentId: string,
  expected: { issueId: string; creatorId: string; body: string },
): Promise<void> {
  const row = await prisma.comment.findUnique({ where: { id: commentId } });
  expect(row).not.toBeNull();
  expect(row?.issueId).toBe(expected.issueId);
  expect(row?.creatorId).toBe(expected.creatorId);
  expect(row?.body).toBe(expected.body);
}

export async function expectNoCommentWithId(commentId: string): Promise<void> {
  const row = await prisma.comment.findUnique({ where: { id: commentId } });
  expect(row).toBeNull();
}

export async function expectCommentStillExists(commentId: string): Promise<void> {
  const row = await prisma.comment.findUnique({ where: { id: commentId } });
  expect(row).not.toBeNull();
}

export async function expectNoCommentsOnIssue(issueId: string): Promise<void> {
  const rows = await prisma.comment.findMany({ where: { issueId } });
  expect(rows).toHaveLength(0);
}

export async function expectCommentCountOnIssue(
  issueId: string,
  expectedCount: number,
): Promise<void> {
  const rows = await prisma.comment.findMany({ where: { issueId } });
  expect(rows).toHaveLength(expectedCount);
}
