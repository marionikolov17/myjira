import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Request, Response } from 'express';

import { AuthenticationError } from '@/common/errors';
import { createAuthenticationMiddleware } from '@/common/middlewares';
import { ITokenService } from '@/common/token-service';

import { IActorContextService } from '@/modules/auth/actor-context.interface';

import { createMockTokenService } from '../../mocks/token-service.mock';
import { createMockActorContextService } from '../../mocks/actor-context.service.mock';

import { VALID_TOKEN, mockTokenPayload, mockActorContext } from './authentication.middleware.mock';

function createRequest(authorization?: string): Request {
  return { headers: authorization === undefined ? {} : { authorization } } as Request;
}

describe('authentication middleware', () => {
  let mockTokenService: jest.Mocked<ITokenService>;
  let mockActorContextService: jest.Mocked<IActorContextService>;

  let middleware: ReturnType<typeof createAuthenticationMiddleware>;

  let res: Response;
  let next: jest.Mock;

  function expectNextCalledOnce(): void {
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  }

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();

    mockTokenService = createMockTokenService();
    mockTokenService.verifyToken.mockReturnValue(mockTokenPayload);

    mockActorContextService = createMockActorContextService();
    mockActorContextService.buildActorContext.mockResolvedValue(mockActorContext);

    middleware = createAuthenticationMiddleware({
      tokenService: mockTokenService,
      actorContextService: mockActorContextService,
    });

    res = {} as Response;
    next = jest.fn();
  });

  it('should attach the actor context and call next() for a valid Bearer token', async () => {
    const req = createRequest(`Bearer ${VALID_TOKEN}`);

    await middleware(req, res, next);

    expect(mockTokenService.verifyToken).toHaveBeenCalledWith(VALID_TOKEN);
    expect(mockActorContextService.buildActorContext).toHaveBeenCalledWith(mockTokenPayload);
    expect(req.actor).toEqual(mockActorContext);
    expectNextCalledOnce();
  });

  it.each([
    { case: 'a lowercase bearer scheme', scheme: 'bearer' },
    { case: 'an uppercase BEARER scheme', scheme: 'BEARER' },
    { case: 'a mixed-case BeArEr scheme', scheme: 'BeArEr' },
  ])('should accept $case as a valid Bearer token', async ({ scheme }) => {
    const req = createRequest(`${scheme} ${VALID_TOKEN}`);

    await middleware(req, res, next);

    expect(mockTokenService.verifyToken).toHaveBeenCalledWith(VALID_TOKEN);
    expect(req.actor).toEqual(mockActorContext);
    expectNextCalledOnce();
  });

  it('should leave req.actor undefined and call next() when there is no Authorization header', async () => {
    const req = createRequest();

    await middleware(req, res, next);

    expect(req.actor).toBeUndefined();
    expect(mockTokenService.verifyToken).not.toHaveBeenCalled();
    expectNextCalledOnce();
  });

  it('should leave req.actor undefined and call next() when the token is invalid or expired', async () => {
    mockTokenService.verifyToken.mockImplementation(() => {
      throw new AuthenticationError();
    });
    const req = createRequest(`Bearer ${VALID_TOKEN}`);

    await middleware(req, res, next);

    expect(mockTokenService.verifyToken).toHaveBeenCalledWith(VALID_TOKEN);
    expect(req.actor).toBeUndefined();
    expect(mockActorContextService.buildActorContext).not.toHaveBeenCalled();
    expectNextCalledOnce();
  });

  it('should leave req.actor undefined and call next() when the actor context cannot be built', async () => {
    mockActorContextService.buildActorContext.mockRejectedValue(new AuthenticationError());
    const req = createRequest(`Bearer ${VALID_TOKEN}`);

    await middleware(req, res, next);

    expect(req.actor).toBeUndefined();
    expectNextCalledOnce();
  });

  it('should propagate the error to next() when building the actor context fails unexpectedly', async () => {
    const unexpectedError = new Error('database unavailable');
    mockActorContextService.buildActorContext.mockRejectedValue(unexpectedError);
    const req = createRequest(`Bearer ${VALID_TOKEN}`);

    await middleware(req, res, next);

    expect(req.actor).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(unexpectedError);
  });

  it.each([
    { case: 'a non-Bearer scheme', header: `Basic ${VALID_TOKEN}` },
    { case: 'a bare token with no scheme', header: VALID_TOKEN },
    { case: 'a Bearer scheme with no token', header: 'Bearer' },
    { case: 'a Bearer scheme with a trailing space and empty token', header: 'Bearer ' },
    { case: 'more than two whitespace-separated parts', header: `Bearer ${VALID_TOKEN} extra` },
    { case: 'an empty Authorization header', header: '' },
  ])('should leave req.actor undefined and call next() for $case', async ({ header }) => {
    const req = createRequest(header);

    await middleware(req, res, next);

    expect(req.actor).toBeUndefined();
    expect(mockTokenService.verifyToken).not.toHaveBeenCalled();
    expectNextCalledOnce();
  });
});
