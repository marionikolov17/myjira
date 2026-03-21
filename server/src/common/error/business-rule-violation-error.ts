import { AppError } from './app-error';
import { ErrorCodes } from './error-codes';

export class BusinessRuleViolationError extends AppError {
  constructor(message: string) {
    super(message, ErrorCodes.BUSINESS_RULE_VIOLATION, 422);
  }
}
