import { AppError } from './app-error';
import { ErrorCodes } from './error-codes';

export class InvalidLoginCredentialsError extends AppError {
  constructor() {
    super('Invalid login credentials', ErrorCodes.INVALID_LOGIN_CREDENTIALS, 401);
  }
}
