import { describe, expect, it } from '@jest/globals';
import { Prisma } from '../../../../prisma/generated/prisma/client';
import { mapPrismaError } from '@/common/utils/map-prisma-error';
import { BusinessRuleViolationError, ConflictError, ResourceNotFoundError } from '@/common/errors';

describe('mapPrismaError', () => {
  function createKnownRequestError(
    code: string,
    meta?: Record<string, unknown>,
  ): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError('test', {
      code,
      clientVersion: 'test',
      meta,
    });
  }

  it('should map unique_violation (P2002) to ConflictError', () => {
    const error = createKnownRequestError('P2002');
    const result = mapPrismaError(error);
    expect(result).toBeInstanceOf(ConflictError);
  });

  it('should map foreign_key_violation (P2003) to ConflictError', () => {
    const error = createKnownRequestError('P2003');
    const result = mapPrismaError(error);
    expect(result).toBeInstanceOf(ConflictError);
  });

  it('should map record_not_found (P2025) to ResourceNotFoundError', () => {
    const error = createKnownRequestError('P2025', { modelName: 'User' });
    const result = mapPrismaError(error);
    expect(result).toBeInstanceOf(ResourceNotFoundError);
  });

  it('should map check_violation (meta.code 23514) to BusinessRuleViolationError', () => {
    const error = createKnownRequestError('P2010', { code: '23514' });
    const result = mapPrismaError(error);
    expect(result).toBeInstanceOf(BusinessRuleViolationError);
  });

  it('should return the original Error when the error code is not in the map', () => {
    const error = createKnownRequestError('P9999');
    const result = mapPrismaError(error);
    expect(result).toBe(error);
  });

  it('should pass through non-Prisma Error instances unchanged', () => {
    const error = new Error('boom');
    const result = mapPrismaError(error);
    expect(result).toBe(error);
  });

  it('should wrap non-Error values in a generic Error', () => {
    const result = mapPrismaError('something went wrong');
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('something went wrong');
  });
});
