import { describe, expect, it } from '@jest/globals';
import { PostgrestError } from '@supabase/supabase-js';
import { mapSupabaseError } from '@/common/utils/map-supabase-error';
import { ConflictError, BusinessRuleViolationError } from '@/common/errors';

describe('mapSupabaseError', () => {
  function createPostgrestError(code: string) {
    return new PostgrestError({ code, message: 'test', details: 'test', hint: 'test' });
  }

  it('should map unique_violation (23505) to ConflictError', () => {
    const error = createPostgrestError('23505');
    const result = mapSupabaseError(error);
    expect(result).toBeInstanceOf(ConflictError);
  });

  it('should map foreign_key_violation (23503) to ConflictError', () => {
    const error = createPostgrestError('23503');
    const result = mapSupabaseError(error);
    expect(result).toBeInstanceOf(ConflictError);
  });

  it('should map check_violation (23514) to BusinessRuleViolationError', () => {
    const error = createPostgrestError('23514');
    const result = mapSupabaseError(error);
    expect(result).toBeInstanceOf(BusinessRuleViolationError);
  });

  it('should return an Error when the error code is not in the map', () => {
    const error = createPostgrestError('12345');
    const result = mapSupabaseError(error);
    expect(result).toBeInstanceOf(Error);
  });
});
