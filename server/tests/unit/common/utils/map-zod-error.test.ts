import { describe, expect, it } from '@jest/globals';
import { z } from 'zod';
import { mapZodError } from '@/common/utils/map-zod-error';
import { ValidationError } from '@/common/errors';
import { ErrorCodes } from '@/common/errors/error-codes';

describe('mapZodError', () => {
  function getZodError(schema: z.ZodType, input: unknown): z.ZodError {
    const result = schema.safeParse(input);
    if (result.success) {
      throw new Error('Expected schema to fail');
    }
    return result.error;
  }

  it('should return a ValidationError with status 400 and VALIDATION_ERROR code', () => {
    const schema = z.object({ name: z.string() });
    const error = getZodError(schema, { name: 123 });

    const result = mapZodError(error);

    expect(result).toBeInstanceOf(ValidationError);
    expect(result.status).toBe(400);
    expect(result.code).toBe(ErrorCodes.VALIDATION_ERROR);
  });

  it('should map a single-field error to one IErrorField', () => {
    const schema = z.object({ name: z.string() });
    const error = getZodError(schema, { name: 123 });

    const result = mapZodError(error);

    expect(result.details?.fields).toHaveLength(1);
    expect(result.details?.fields?.[0]).toEqual({
      name: 'name',
      message: expect.any(String),
    });
  });

  it('should map multiple field errors to multiple IErrorFields', () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const error = getZodError(schema, { name: 123, age: 'old' });

    const result = mapZodError(error);

    expect(result.details?.fields).toHaveLength(2);
    expect(result.details?.fields).toEqual(
      expect.arrayContaining([
        { name: 'name', message: expect.any(String) },
        { name: 'age', message: expect.any(String) },
      ]),
    );
  });

  it('should join nested paths with a dot', () => {
    const schema = z.object({ user: z.object({ email: z.string().email() }) });
    const error = getZodError(schema, { user: { email: 'not-an-email' } });

    const result = mapZodError(error);

    expect(result.details?.fields?.[0]?.name).toBe('user.email');
  });

  it('should use an empty string as field name when path is empty', () => {
    const schema = z.string();
    const error = getZodError(schema, 123);

    const result = mapZodError(error);

    expect(result.details?.fields?.[0]?.name).toBe('');
  });
});
