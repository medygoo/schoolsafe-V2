export type ApiErrorCode =
  | "AUTH_REQUIRED"
  | "PERMISSION_DENIED"
  | "ACCESS_DENIED"
  | "SCOPE_DENIED"
  | "VALIDATION_INVALID"
  | "VERSION_CONFLICT"
  | "IDEMPOTENCY_DUPLICATE"
  | "DEPENDENCY_UNAVAILABLE"
  | "SETUP_TOKEN_INVALID"
  | "SETUP_SCHOOL_FAILED"
  | "SETUP_ADMIN_FAILED"
  | "SCHOOL_NOT_FOUND"
  | "FILE_MISSING"
  | "FILE_INVALID"
  | "FILE_TOO_LARGE"
  | "INTERNAL_ERROR";

export type ApiErrorBody = {
  code: ApiErrorCode;
  message: string;
  request_id: string;
  retryable: boolean;
};

export class SchoolSafeError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ApiErrorCode,
    public readonly publicMessage: string,
    public readonly retryable: boolean
  ) {
    super(publicMessage);
    this.name = "SchoolSafeError";
  }
}
