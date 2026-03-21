import { AppError } from './app-error';
import { ErrorCodes } from './error-codes';

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, ErrorCodes.CONFLICT, 409);
  }
}
