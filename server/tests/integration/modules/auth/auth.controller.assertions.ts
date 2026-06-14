import { expect } from '@jest/globals';
import supertest from 'supertest';

import { prisma } from '@/common/lib/prisma';
import { TokenPayload } from '@/common/token-service';

import { TestUser } from '../../fixtures/users.fixtures';

export async function expectTokenPayload(payload: TokenPayload, testUser: TestUser): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: testUser.email },
  });

  expect(user).not.toBeNull();
  expect(user?.id).toBeDefined();

  expect(payload.userId).toBe(user?.id);

  expect(payload.workspaceRoleId).toBeDefined();
  expect(payload.workspaceRoleId).toBe(user?.workspaceRoleId);

  expect(payload.iat).toBeDefined();
  expect(payload.exp).toBeDefined();

  expect(payload.exp).toBeGreaterThan(payload.iat);
}

export function expectSuccessfulLogin(response: supertest.Response): void {
  expect(response.status).toBe(200);
  expect(response.body.data.token).toBeDefined();
}

export function expectInvalidLoginCredentialsError(response: supertest.Response): void {
  expect(response.status).toBe(401);
  expect(response.body.error.message).toBe('Invalid login credentials');
}
