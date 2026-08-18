export class SchoolSafeError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    public readonly publicMessage: string,
    public readonly retryable: boolean,
  ) {
    super(publicMessage);
  }
}

export type ApiErrorBody = {
  code: string;
  message: string;
  request_id: string;
  retryable: boolean;
};
