import { z } from 'zod';

export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'AUTHENTICATION_REQUIRED',
  'FORBIDDEN',
  'RESOURCE_NOT_FOUND',
  'BUSINESS_RULE_VIOLATION',
  'CONFLICT',
  'INVALID_LOGIN_CREDENTIALS',
  'INTERNAL_SERVER_ERROR',
  // Custom codes
  'TRANSPORT_UNAVAILABLE',
] as const;

const FRIENDLY_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  AUTHENTICATION_REQUIRED: 'Your session has expired. Please sign in again.',
  INVALID_LOGIN_CREDENTIALS: 'The email or password you entered is incorrect.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  TRANSPORT_UNAVAILABLE: 'Could not reach the server. Check your connection and try again.',
};

export const apiErrorCodeSchema = z.enum(API_ERROR_CODES);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const validationFieldErrorSchema = z.object({
  name: z.string(),
  message: z.string(),
});
export type ValidationFieldError = z.infer<typeof validationFieldErrorSchema>;

export const apiErrorDetailsSchema = z.object({
  fields: z.array(validationFieldErrorSchema).optional(),
  resource: z
    .object({
      resourceName: z.string(),
      resourceId: z.string().optional(),
    })
    .optional(),
});
export type ApiErrorDetails = z.infer<typeof apiErrorDetailsSchema>;

export const apiErrorPayloadSchema = z.object({
  code: apiErrorCodeSchema,
  status: z.number(),
  message: z.string(),
  details: apiErrorDetailsSchema.optional(),
});
export type ApiErrorPayload = z.infer<typeof apiErrorPayloadSchema>;

export const apiErrorBodySchema = z.object({
  error: apiErrorPayloadSchema,
});
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: ApiErrorDetails;

  constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.name = 'ApiError';
    this.code = payload.code;
    this.status = payload.status;
    this.details = payload.details;
  }

  static fromBody(body: ApiErrorBody): ApiError {
    return new ApiError(body.error);
  }

  toBody(): ApiErrorBody {
    return {
      error: {
        code: this.code,
        status: this.status,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isForbiddenOrNotFound(error: unknown): boolean {
  return isApiError(error) && (error.code === 'FORBIDDEN' || error.code === 'RESOURCE_NOT_FOUND');
}

export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) return getApiErrorMessageFromCode(error.code, error.message);
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

export function getApiErrorMessageFromCode(code: ApiErrorCode, message?: string): string {
  const friendly = FRIENDLY_MESSAGES[code];
  return friendly ?? message ?? 'Something went wrong. Please try again.';
}
