import { AppError } from './app-error';
import { ErrorCodes } from './error-codes';

export class AuthorizationError extends AppError {
  constructor() {
    super('Forbidden', ErrorCodes.FORBIDDEN, 403);
  }
}
