import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import { SchoolSafeError } from "../http/errors.js";
import type { AccessService } from "./service.js";

export interface PermissionScope {
  type: string;
  id?: string | null;
}

export function extractBearerToken(header?: string): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

export function requirePermission(
  access: AccessService,
  permissionCode: string,
  scope?: PermissionScope,
): preHandlerHookHandler {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new SchoolSafeError(401, "AUTH_REQUIRED", "Authentification requise", false);
    }

    const allowed = await access.hasPermission(token, permissionCode);
    if (!allowed) {
      throw new SchoolSafeError(403, "ACCESS_DENIED", "Permission refusée", false);
    }

    if (scope) {
      const inScope = await access.hasScope(token, scope.type, scope.id ?? null);
      if (!inScope) {
        throw new SchoolSafeError(403, "SCOPE_DENIED", "Hors périmètre autorisé", false);
      }
    }
  };
}
