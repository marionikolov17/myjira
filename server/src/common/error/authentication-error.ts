import { AppError } from './app-error';
import { ErrorCodes } from './error-codes';

export class AuthenticationError extends AppError {
  constructor() {
    super('Authentication required', ErrorCodes.AUTHENTICATION_REQUIRED, 401);
  }
}
