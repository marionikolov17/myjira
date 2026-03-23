import { NextFunction, Request, Response } from 'express';
import { logger } from '../logger';

export const loggerRequestMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  logger.http(`[${req.method}] ${req.url}`, {
    request: {
      url: req.url,
      method: req.method,
      body: req.body,
    },
  });

  return next();
};
