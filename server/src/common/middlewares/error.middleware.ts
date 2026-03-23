import { NextFunction, Request, Response } from 'express';
import { AppError, ErrorCodes } from '@/common/errors';
import { logger } from '@/common/logger';

export const errorMiddleware = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction, // eslint-disable-line @typescript-eslint/no-unused-vars
): Response => {
  logger.error(`[${req.method}] ${req.url}`, {
    message: err.message,
    stack: err.stack,
    request: {
      url: req.url,
      method: req.method,
      body: req.body,
    },
  });

  const status = err instanceof AppError ? err.status : 500;
  const code = err instanceof AppError ? err.code : ErrorCodes.INTERNAL_SERVER_ERROR;
  const message = err instanceof AppError ? err.message : 'Internal server error';
  const details = err instanceof AppError ? err.details : undefined;

  return res.status(status).json({
    error: {
      code,
      message,
      details,
    },
  });
};
