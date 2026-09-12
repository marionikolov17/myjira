import { NextFunction, Request, Response } from 'express';
import { redactTokenQueryParam } from '@/common/utils/redact-token-query-param';
import { logger } from '../logger';

export const loggerRequestMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  logger.http(`[${req.method}] ${redactTokenQueryParam(req.url)}`);
  return next();
};
