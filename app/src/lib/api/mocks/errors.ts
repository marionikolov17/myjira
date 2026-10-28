import type { z } from 'zod'
import { ApiError, type ValidationFieldError } from '@/lib/api/schemas'

export const authenticationRequired = () =>
  new ApiError({
    code: 'AUTHENTICATION_REQUIRED',
    status: 401,
    message: 'Your session has expired. Please sign in again.',
  })

export const invalidLoginCredentials = () =>
  new ApiError({
    code: 'INVALID_LOGIN_CREDENTIALS',
    status: 401,
    message: 'The email or password you entered is incorrect.',
  })

export const forbidden = (message = 'You do not have permission to perform this action.') =>
  new ApiError({ code: 'FORBIDDEN', status: 403, message })

export const notFound = (resourceName: string, resourceId?: string) =>
  new ApiError({
    code: 'RESOURCE_NOT_FOUND',
    status: 404,
    message: `${resourceName} not found.`,
    details: { resource: { resourceName, ...(resourceId ? { resourceId } : {}) } },
  })

export const validationError = (fields: ValidationFieldError[], message = 'The request contains invalid fields.') =>
  new ApiError({ code: 'VALIDATION_ERROR', status: 400, message, details: { fields } })

export const conflict = (message: string) => new ApiError({ code: 'CONFLICT', status: 409, message })

export const businessRuleViolation = (message: string) =>
  new ApiError({ code: 'BUSINESS_RULE_VIOLATION', status: 422, message })

export function validate<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input)
  if (result.success) return result.data
  throw validationError(
    result.error.issues.map((issue) => ({
      name: issue.path.length > 0 ? issue.path.join('.') : 'body',
      message: issue.message,
    })),
  )
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function assertUuid(name: string, value: string): void {
  if (!UUID_PATTERN.test(value)) throw validationError([{ name, message: `${name} must be a valid UUID` }])
}
