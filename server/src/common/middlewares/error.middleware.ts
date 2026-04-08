import { NextFunction, Request, Response } from 'express';
import { AppError, ErrorCodes } from '@/common/errors';

export const errorMiddleware = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction, // eslint-disable-line @typescript-eslint/no-unused-vars
): Response => {
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
