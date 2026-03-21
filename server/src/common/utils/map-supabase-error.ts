import { PostgrestError } from '@supabase/supabase-js';
import { AppError } from '../errors/app-error';
import { ConflictError } from '../errors/conflict-error';
import { BusinessRuleViolationError } from '../errors/business-rule-violation-error';

type ErrorMapper = (error: PostgrestError) => AppError;

const SUPABASE_ERROR_MAP: Record<string, ErrorMapper> = {
  '23505': (error) => new ConflictError(error.message),
  '23503': (error) => new ConflictError(error.message),
  '23514': (error) => new BusinessRuleViolationError(error.message),
};

export function mapSupabaseError(error: PostgrestError): Error {
  const mapper = SUPABASE_ERROR_MAP[error.code];

  if (mapper) {
    return mapper(error);
  }

  return new Error(error.message, { cause: error });
}
