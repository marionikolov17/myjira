import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Request, Response } from 'express';

import { AuthenticationError } from '@/common/errors';
import { requireAuthenticationMiddleware } from '@/common/middlewares';

import { mockActorContext } from './require-authentication.middleware.mock';

describe('require authentication middleware', () => {
  let res: Response;
  let next: jest.Mock;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();

    res = {} as Response;
    next = jest.fn();
  });

  it('should call next() with no error when req.actor is present', () => {
    const req = { actor: mockActorContext } as Request;

    requireAuthenticationMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('should call next() with an AuthenticationError when req.actor is absent', () => {
    const req = {} as Request;

    requireAuthenticationMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0]?.[0];
    expect(error).toBeInstanceOf(AuthenticationError);
  });
});
