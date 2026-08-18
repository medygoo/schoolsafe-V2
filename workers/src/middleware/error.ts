import type { Context, Next } from "hono";
import { SchoolSafeError } from "../lib/errors.js";
import { newRequestId } from "../lib/request-id.js";

export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (error) {
    const requestId = newRequestId();
    if (error instanceof SchoolSafeError) {
      return c.json(
        { code: error.code, message: error.publicMessage, request_id: requestId, retryable: error.retryable },
        error.statusCode,
      );
    }
    return c.json(
      { code: "INTERNAL_ERROR", message: "Erreur interne", request_id: requestId, retryable: false },
      500,
    );
  }
}
