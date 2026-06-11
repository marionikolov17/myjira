import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, ErrorCodes } from '@/common/errors';
import { mapZodError } from '@/common/utils/map-zod-error';

export const errorMiddleware = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction, // eslint-disable-line @typescript-eslint/no-unused-vars
): Response => {
  if (err instanceof ZodError) {
    const validationError = mapZodError(err);
    return res.status(validationError.status).json({
      error: {
        code: validationError.code,
        message: validationError.message,
        details: validationError.details,
      },
    });
  }

  const status = err instanceof AppError ? err.status : 500;
  const code = err instanceof AppError ? err.code : ErrorCodes.INTERNAL_SERVER_ERROR;
  const message = err instanceof AppError ? err.message : 'Internal server error';
  const details = err instanceof AppError ? err.details : undefined;

  return res.status(status).json({
    error: {
      code,
      status,
      message,
      details,
    },
  });
};
