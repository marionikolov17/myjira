import { Prisma } from '../../../prisma/generated/prisma/client';
import { AppError } from '../errors/app-error';
import { ConflictError } from '../errors/conflict-error';
import { BusinessRuleViolationError } from '../errors/business-rule-violation-error';
import { ResourceNotFoundError } from '../errors/resource-not-found-error';

type ErrorMapper = (error: Prisma.PrismaClientKnownRequestError) => AppError;

const PRISMA_ERROR_MAP: Record<string, ErrorMapper> = {
  P2002: (error) => new ConflictError(error.message),
  P2003: (error) => new ConflictError(error.message),
  P2025: (error) => new ResourceNotFoundError({ resourceName: getModelName(error) }),
};

const PG_CHECK_VIOLATION_CODE = '23514';

export function mapPrismaError(error: unknown): Error {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (getUnderlyingPgCode(error) === PG_CHECK_VIOLATION_CODE) {
      return new BusinessRuleViolationError(error.message);
    }

    const mapper = PRISMA_ERROR_MAP[error.code];
    if (mapper) {
      return mapper(error);
    }
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

function getUnderlyingPgCode(error: Prisma.PrismaClientKnownRequestError): string | undefined {
  const meta = error.meta as { code?: unknown } | undefined;
  return typeof meta?.code === 'string' ? meta.code : undefined;
}

function getModelName(error: Prisma.PrismaClientKnownRequestError): string {
  const meta = error.meta as { modelName?: unknown } | undefined;
  return typeof meta?.modelName === 'string' ? meta.modelName : 'resource';
}
