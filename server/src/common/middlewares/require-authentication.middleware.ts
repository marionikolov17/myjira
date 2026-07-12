import { NextFunction, Request, RequestHandler, Response } from 'express';
import { AuthenticationError } from '@/common/errors';

export const requireAuthenticationMiddleware: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (req.actor) {
    next();
    return;
  }

  next(new AuthenticationError());
};
