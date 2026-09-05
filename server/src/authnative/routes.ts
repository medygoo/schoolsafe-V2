// SchoolSafe Auth v1 — routes HTTP de session.
// Session opaque côté navigateur (cookie HttpOnly) ; haché seul côté serveur/DB.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { SchoolSafeError } from "../http/errors.js";
import { newRequestId } from "../http/request-id.js";
import { clearSessionCookie, readSessionCookie, setSessionCookie } from "./cookie.js";
import type { AuthNativeService } from "./service.js";

const loginSchema = z.object({
  login: z.string().min(1).max(320),
  password: z.string().min(1).max(512),
  profileId: z.string().uuid().optional(),
});

export type AuthNativeRouteDependencies = {
  service: AuthNativeService;
  cookieSecure: boolean;
};

export function registerAuthNativeRoutes(
  app: FastifyInstance,
  dependencies: AuthNativeRouteDependencies,
): void {
  const { service, cookieSecure } = dependencies;

  app.post("/auth/native/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const result = await service.loginWithPassword(
      body.login,
      body.password,
      body.profileId,
      request.ip,
      request.headers["user-agent"],
    );

    if (!result.ok && result.reason === "profile_choice_required") {
      return reply.code(200).send({
        code: "PROFILE_CHOICE_REQUIRED",
        profiles: result.profiles,
        request_id: newRequestId(),
      });
    }
    if (!result.ok) {
      // Réponse identique pour identité inconnue / mot de passe faux /
      // désactivé / verrouillé : aucune énumération possible.
      throw new SchoolSafeError(401, "AUTH_REQUIRED", "Identifiants invalides", false);
    }

    setSessionCookie(reply, result.token, {
      secure: cookieSecure,
      maxAgeSeconds: 43200,
    });
    return reply.code(200).send({
      profile_id: result.session.profileId,
      must_change: result.session.mustChange,
      expires_at: result.session.expiresAt,
      request_id: newRequestId(),
    });
  });

  app.post("/auth/native/logout", async (request, reply) => {
    const token = readSessionCookie(request);
    if (token) {
      await service.logout(token);
    }
    clearSessionCookie(reply, { secure: cookieSecure });
    return reply.code(200).send({ status: "logged_out", request_id: newRequestId() });
  });

  app.get("/auth/native/me", async (request, reply) => {
    const token = readSessionCookie(request);
    if (!token) {
      throw new SchoolSafeError(401, "AUTH_REQUIRED", "Session requise", false);
    }
    const session = await service.resolveSession(token);
    if (!session) {
      throw new SchoolSafeError(401, "AUTH_REQUIRED", "Session invalide ou expirée", false);
    }

    // Expiration glissante : passée la mi-vie, la session est prolongée
    // et le cookie renouvelé avec la nouvelle échéance.
    const renewed = await service.touchSession(token);
    if (renewed) {
      setSessionCookie(reply, token, { secure: cookieSecure, maxAgeSeconds: 43200 });
    }

    return reply.code(200).send({
      user_id: session.userId,
      profile_id: session.profileId,
      school_id: session.schoolId,
      must_change: session.mustChange,
      request_id: newRequestId(),
    });
  });
}
