import type { Context, Next } from "hono";
import { SchoolSafeError } from "../lib/errors.js";
import { extractBearer } from "./auth.js";
import type { AccessService } from "../services/access.js";

export function requirePermission(access: AccessService, permission: string) {
  return async (c: Context, next: Next) => {
    const token = extractBearer(c);
    if (!token) throw new SchoolSafeError(401, "AUTH_REQUIRED", "Token manquant", false);
    const ok = await access.hasPermission(token, permission);
    if (!ok) throw new SchoolSafeError(403, "PERMISSION_DENIED", "Permission refusée", false);
    await next();
  };
}

export function requireScope(access: AccessService, scopeType: string, scopeId?: string) {
  return async (c: Context, next: Next) => {
    const token = extractBearer(c);
    if (!token) throw new SchoolSafeError(401, "AUTH_REQUIRED", "Token manquant", false);
    const ok = await access.hasScope(token, scopeType, scopeId);
    if (!ok) throw new SchoolSafeError(403, "SCOPE_DENIED", "Portée refusée", false);
    await next();
  };
}
