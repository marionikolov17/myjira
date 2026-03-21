import { AppError } from './app-error';
import { IErrorField } from './error.interface';
import { ErrorCodes } from './error-codes';

export class ValidationError extends AppError {
  constructor(fields: IErrorField[]) {
    super('Validation error', ErrorCodes.VALIDATION_ERROR, 400);
    this.details = { fields };
  }
}
