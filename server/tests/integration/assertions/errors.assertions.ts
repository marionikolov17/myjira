import { expect } from '@jest/globals';
import supertest from 'supertest';

import { ErrorCodes } from '@/common/errors/error-codes';

export function expectConflictError(response: supertest.Response): void {
  expect(response.status).toBe(409);
  expect(response.body.error?.code).toBe(ErrorCodes.CONFLICT);
}

export function expectInternalServerError(response: supertest.Response): void {
  expect(response.status).toBe(500);
  expect(response.body.error?.code).toBe(ErrorCodes.INTERNAL_SERVER_ERROR);
}

export function expectForbiddenError(response: supertest.Response): void {
  expect(response.status).toBe(403);
  expect(response.body.error?.code).toBe(ErrorCodes.FORBIDDEN);
}

export function expectResourceNotFoundError(
  response: supertest.Response,
  resourceName: string,
): void {
  expect(response.status).toBe(404);
  const error = response.body.error;
  expect(error?.code).toBe(ErrorCodes.RESOURCE_NOT_FOUND);
  expect(error?.details?.resource?.resourceName).toBe(resourceName);
}
