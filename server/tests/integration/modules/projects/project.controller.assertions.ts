import { expect } from '@jest/globals';
import supertest from 'supertest';

import { prisma } from '@/common/lib/prisma';
import { ProjectRoleName } from '@/modules/project-roles';

interface ExpectedProject {
  name: string;
  description: string;
  creatorId: string;
}

/**
 * Asserts that a response body returns the project resource with exactly the
 * safe set of fields and nothing else. An exact-shape `toEqual` ensures any
 * future column leaking into the response fails this helper immediately.
 */
export function expectProjectResponse(
  response: supertest.Response,
  status: 200 | 201,
  expected: ExpectedProject,
): void {
  expect(response.status).toBe(status);

  const project = response.body.data;

  expect(project).toEqual({
    id: expect.any(String),
    name: expected.name,
    description: expected.description,
    creatorId: expected.creatorId,
    createdAt: expect.any(String),
    updatedAt: expect.any(String),
  });
}

export function expectProjectResponseById(
  response: supertest.Response,
  expected: ExpectedProject & { id: string },
): void {
  expect(response.status).toBe(200);

  const project = response.body.data;

  expect(project).toEqual({
    id: expected.id,
    name: expected.name,
    description: expected.description,
    creatorId: expected.creatorId,
    createdAt: expect.any(String),
    updatedAt: expect.any(String),
  });
}

/**
 * Asserts the response has 204 and an empty body.
 */
export function expectNoContentResponse(response: supertest.Response): void {
  expect(response.status).toBe(204);
  expect(response.body).toEqual({});
}

/**
 * Asserts that the persisted project row carries the expected fields and that
 * exactly one Project Owner membership exists for the given actor.
 */
export async function expectProjectAndOwnerMemberPersisted(
  projectId: string,
  expected: { name: string; description: string; creatorId: string },
): Promise<void> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  expect(project).not.toBeNull();
  expect(project?.name).toBe(expected.name);
  expect(project?.description).toBe(expected.description);
  expect(project?.creatorId).toBe(expected.creatorId);

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { projectRole: true },
  });
  expect(members).toHaveLength(1);
  expect(members[0]?.userId).toBe(expected.creatorId);
  expect(members[0]?.projectRole.name).toBe(ProjectRoleName.PROJECT_OWNER);
}

/**
 * Asserts no project row persists for the given id.
 */
export async function expectProjectAbsent(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  expect(project).toBeNull();
}

/**
 * Asserts no project row persists with the given name.
 */
export async function expectNoProjectWithName(name: string): Promise<void> {
  const projects = await prisma.project.findMany({ where: { name } });
  expect(projects).toHaveLength(0);
}
