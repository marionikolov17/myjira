import { NextFunction, Request, Response } from 'express';
import { logger } from '../logger';

export const loggerRequestMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  logger.http(`[${req.method}] ${req.url}`);
  return next();
};
