import { expect } from '@jest/globals';
import supertest from 'supertest';

import { ActorContext } from '@/common/interfaces';

export function expectActorContextResponse(
  response: supertest.Response,
  expectedActor: ActorContext,
): void {
  expect(response.status).toBe(200);
  expect(response.body.data).toEqual(expectedActor);
}
