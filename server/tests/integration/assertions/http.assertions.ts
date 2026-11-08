import { expect } from '@jest/globals';
import supertest from 'supertest';

/**
 * Asserts a 204 No Content response with an empty body.
 */
export function expectNoContentResponse(response: supertest.Response): void {
  expect(response.status).toBe(204);
  expect(response.body).toEqual({});
}
