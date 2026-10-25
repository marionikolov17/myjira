import { expect } from '@jest/globals';
import supertest from 'supertest';

import { prisma } from '@/common/lib/prisma';
import { ProjectRoleName } from '@/modules/project-roles';

export interface ExpectedExpandedMember {
  /** When set, the member `id` must match exactly (use for list order checks). */
  id?: string;
  projectId: string;
  user: { id: string; name: string; email: string };
  projectRole: { id: string; name: ProjectRoleName };
}

function expectedExpandedMemberShape(expected: ExpectedExpandedMember) {
  return {
    id: expected.id ?? expect.any(String),
    projectId: expected.projectId,
    user: {
      id: expected.user.id,
      name: expected.user.name,
      email: expected.user.email,
    },
    projectRole: {
      id: expected.projectRole.id,
      name: expected.projectRole.name,
    },
  };
}

/**
 * Asserts the response body carries exactly the expanded project-member shape,
 * with no leaked scalar `userId` or `projectRoleId` fields.
 */
export function expectExpandedMemberResponse(
  response: supertest.Response,
  status: 200 | 201,
  expected: ExpectedExpandedMember,
): void {
  expect(response.status).toBe(status);
  expect(response.body.data).toEqual(expectedExpandedMemberShape(expected));
}

/**
 * Asserts an expanded project-member list envelope: `{ data: [...] }` with NO
 * `meta.pagination` object, and each entry having the exact expanded shape in
 * the given order (repository order is `id` ascending).
 */
export function expectExpandedMemberListResponse(
  response: supertest.Response,
  expectedEntries: ExpectedExpandedMember[],
): void {
  expect(response.status).toBe(200);
  expect(response.body.meta).toBeUndefined();

  const data = response.body.data;
  expect(Array.isArray(data)).toBe(true);
  expect(data).toHaveLength(expectedEntries.length);

  expectedEntries.forEach((expected, i) => {
    expect(data[i]).toEqual(expectedExpandedMemberShape(expected));
  });
}

/**
 * Asserts a 204 No Content response with an empty body.
 */
export function expectNoContentResponse(response: supertest.Response): void {
  expect(response.status).toBe(204);
  expect(response.body).toEqual({});
}

export async function expectMemberPersisted(
  memberId: string,
  expected: { projectId: string; userId: string; projectRoleId: string },
): Promise<void> {
  const row = await prisma.projectMember.findUnique({ where: { id: memberId } });
  expect(row).not.toBeNull();
  expect(row?.projectId).toBe(expected.projectId);
  expect(row?.userId).toBe(expected.userId);
  expect(row?.projectRoleId).toBe(expected.projectRoleId);
}

export async function expectMemberWithRole(
  memberId: string,
  projectRoleName: ProjectRoleName,
): Promise<void> {
  const row = await prisma.projectMember.findUnique({
    where: { id: memberId },
    include: { projectRole: true },
  });
  expect(row).not.toBeNull();
  expect(row?.projectRole.name).toBe(projectRoleName);
}

export async function expectMemberAbsent(memberId: string): Promise<void> {
  const row = await prisma.projectMember.findUnique({ where: { id: memberId } });
  expect(row).toBeNull();
}

export async function expectNoMemberForUser(projectId: string, userId: string): Promise<void> {
  const rows = await prisma.projectMember.findMany({
    where: { projectId, userId },
  });
  expect(rows).toHaveLength(0);
}
