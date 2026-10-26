import { expect } from '@jest/globals';
import supertest from 'supertest';

import { prisma } from '@/common/lib/prisma';
import { IssuePriority, IssueStatus } from '@/modules/issues';

export interface ExpectedIssueResource {
  /** When set, the issue `id` must match exactly. */
  id?: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  projectId: string;
  creator: { id: string; name: string; email: string };
  assignee: { id: string; name: string; email: string };
}

function expectedIssueShape(expected: ExpectedIssueResource) {
  return {
    id: expected.id ?? expect.any(String),
    title: expected.title,
    description: expected.description,
    status: expected.status,
    priority: expected.priority,
    projectId: expected.projectId,
    creator: {
      id: expected.creator.id,
      name: expected.creator.name,
      email: expected.creator.email,
    },
    assignee: {
      id: expected.assignee.id,
      name: expected.assignee.name,
      email: expected.assignee.email,
    },
    createdAt: expect.any(String),
    updatedAt: expect.any(String),
  };
}

/**
 * Asserts the response body carries exactly the expanded issue shape, with no
 * leaked scalar `creatorId` or `assigneeId` fields.
 */
export function expectIssueResource(
  response: supertest.Response,
  status: 200 | 201,
  expected: ExpectedIssueResource,
): void {
  expect(response.status).toBe(status);
  expect(response.body.data).toEqual(expectedIssueShape(expected));
  expect(response.body.data.creatorId).toBeUndefined();
  expect(response.body.data.assigneeId).toBeUndefined();
}

/**
 * Asserts a 204 No Content response with an empty body.
 */
export function expectNoContentResponse(response: supertest.Response): void {
  expect(response.status).toBe(204);
  expect(response.body).toEqual({});
}

export async function expectNoIssueWithId(issueId: string): Promise<void> {
  const row = await prisma.issue.findUnique({ where: { id: issueId } });
  expect(row).toBeNull();
}

export async function expectNoIssuesInProject(projectId: string): Promise<void> {
  const issues = await prisma.issue.findMany({ where: { projectId } });
  expect(issues).toHaveLength(0);
}

export async function expectIssuePersisted(
  issueId: string,
  expected: {
    projectId: string;
    creatorId: string;
    assigneeId: string;
    title: string;
    description: string;
    status: IssueStatus;
    priority: IssuePriority;
  },
): Promise<void> {
  const row = await prisma.issue.findUnique({ where: { id: issueId } });
  expect(row).not.toBeNull();
  expect(row?.projectId).toBe(expected.projectId);
  expect(row?.creatorId).toBe(expected.creatorId);
  expect(row?.assigneeId).toBe(expected.assigneeId);
  expect(row?.title).toBe(expected.title);
  expect(row?.description).toBe(expected.description);
  expect(row?.status).toBe(expected.status);
  expect(row?.priority).toBe(expected.priority);
}

export async function expectIssueUnchanged(
  issueId: string,
  expected: {
    title: string;
    description: string;
    status: IssueStatus;
    priority: IssuePriority;
    assigneeId: string;
  },
): Promise<void> {
  const row = await prisma.issue.findUnique({ where: { id: issueId } });
  expect(row).not.toBeNull();
  expect(row?.title).toBe(expected.title);
  expect(row?.description).toBe(expected.description);
  expect(row?.status).toBe(expected.status);
  expect(row?.priority).toBe(expected.priority);
  expect(row?.assigneeId).toBe(expected.assigneeId);
}

export async function expectIssueStillExists(issueId: string): Promise<void> {
  const row = await prisma.issue.findUnique({ where: { id: issueId } });
  expect(row).not.toBeNull();
}
