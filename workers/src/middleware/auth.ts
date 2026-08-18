import type { Context, Next } from "hono";
import { SchoolSafeError } from "../lib/errors.js";

export function extractBearer(c: Context): string {
  const auth = c.req.header("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return "";
  return auth.slice(7);
}

export function authMiddleware() {
  return async (c: Context, next: Next) => {
    const token = extractBearer(c);
    if (!token) throw new SchoolSafeError(401, "AUTH_REQUIRED", "Authentification requise", false);
    c.set("accessToken", token);
    await next();
  };
}
