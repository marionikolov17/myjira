export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'AUTHENTICATION_REQUIRED',
  'FORBIDDEN',
  'RESOURCE_NOT_FOUND',
  'BUSINESS_RULE_VIOLATION',
  'CONFLICT',
  'INVALID_LOGIN_CREDENTIALS',
  'INTERNAL_SERVER_ERROR',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export type ValidationFieldError = { name: string; message: string };

export type ApiErrorDetails = {
  fields?: ValidationFieldError[];
  resource?: { resourceName: string; resourceId?: string };
};

export type ApiErrorPayload = {
  code: ApiErrorCode;
  status: number;
  message: string;
  details?: ApiErrorDetails;
};

export type ApiErrorBody = { error: ApiErrorPayload };

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
  if (isApiError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
