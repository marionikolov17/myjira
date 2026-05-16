import { ZodError } from 'zod';
import { ValidationError } from '../errors/validation-error';

export function mapZodError(error: ZodError): ValidationError {
  const fields = error.issues.map((issue) => ({
    name: issue.path.join('.'),
    message: issue.message,
  }));

  return new ValidationError(fields);
}
