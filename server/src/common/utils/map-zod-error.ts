import { ZodError } from 'zod';
import { ValidationError } from '../errors/validation-error';

export function mapZodError(error: ZodError): ValidationError {
  const messagesByField = new Map<string, string>();

  const addFirstMessage = (name: string, message: string): void => {
    if (!messagesByField.has(name)) {
      messagesByField.set(name, message);
    }
  };

  for (const issue of error.issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) {
        addFirstMessage(key, issue.message);
      }
      continue;
    }

    addFirstMessage(issue.path.join('.'), issue.message);
  }

  const fields = [...messagesByField].map(([name, message]) => ({ name, message }));

  return new ValidationError(fields);
}
