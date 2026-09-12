import { expect } from '@jest/globals';
import supertest from 'supertest';

import { prisma } from '@/common/lib/prisma';
import { ActorContext } from '@/common/interfaces';

export function expectActorContextResponse(
  response: supertest.Response,
  expectedActor: ActorContext,
): void {
  expect(response.status).toBe(200);
  expect(response.body.data).toEqual(expectedActor);
}

interface ExpectedCreatedUser {
  name: string;
  email: string;
  workspaceRoleId: string;
  activationUrlBase: string;
}

export function expectCreatedUserResponse(
  response: supertest.Response,
  expected: ExpectedCreatedUser,
): void {
  expect(response.status).toBe(201);

  const { user, activation } = response.body.data;

  expect(user).toMatchObject({
    id: expect.any(String),
    name: expected.name,
    email: expected.email,
    workspaceRoleId: expected.workspaceRoleId,
    status: 'Pending',
    createdAt: expect.any(String),
    updatedAt: expect.any(String),
  });

  // The response must never leak credential or token material.
  expect(user).not.toHaveProperty('password');
  expect(user).not.toHaveProperty('activationTokenHash');
  expect(user).not.toHaveProperty('activationTokenExpiresAt');

  // The one-time activation link is present and carries a non-empty token.
  expect(typeof activation.url).toBe('string');
  expect(activation.url.startsWith(expected.activationUrlBase)).toBe(true);
  expect(activation.expiresAt).toEqual(expect.any(String));

  const token = new URL(activation.url).searchParams.get('token');
  expect(token).toBeTruthy();
}

export function extractActivationToken(response: supertest.Response): string {
  const token = new URL(response.body.data.activation.url).searchParams.get('token');
  if (!token) {
    throw new Error('Expected an activation token in the response');
  }
  return token;
}

interface ExpectedPersistedUser {
  workspaceRoleId: string;
  responseUserId: string;
  rawToken: string;
}

/**
 * Asserts the persisted row for a freshly created workspace user: it is stored
 * `Pending` with no password, carries only the activation-token hash (never the
 * raw token), and matches the id returned in the response.
 */
export async function expectPendingUserPersisted(
  email: string,
  expected: ExpectedPersistedUser,
): Promise<void> {
  const persisted = await prisma.user.findUnique({ where: { email } });

  expect(persisted).not.toBeNull();
  expect(persisted?.id).toBe(expected.responseUserId);
  expect(persisted?.workspaceRoleId).toBe(expected.workspaceRoleId);
  expect(persisted?.password).toBeNull();
  expect(persisted?.status).toBe('Pending');
  expect(persisted?.activationTokenHash).toEqual(expect.any(String));
  expect(persisted?.activationTokenExpiresAt).toBeInstanceOf(Date);
  // Only the hash is stored; the raw token is never persisted.
  expect(persisted?.activationTokenHash).not.toBe(expected.rawToken);
}
