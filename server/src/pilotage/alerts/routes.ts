import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { SchoolSafeError } from "../../http/errors.js";
import { extractBearerToken } from "../../auth/session.js";
import type { AlertService } from "./service.js";
import { listAlertsSchema, acknowledgeAlertSchema, resolveAlertSchema } from "./schema.js";
import { requirePermission } from "../../access/guard.js";
import type { AccessService } from "../../access/service.js";

export type ResolveProfileIdAndSchool = (token: string) => Promise<{ profileId: string | null; schoolId: string | null }>;

export type AlertRouteDependencies = {
  service: AlertService;
  resolveProfileAndSchool: ResolveProfileIdAndSchool;
  access: AccessService;
};

export function registerAlertRoutes(app: FastifyInstance, dependencies: AlertRouteDependencies): void {
  app.get(
    "/pilotage/alerts",
    { preHandler: [requirePermission(dependencies.access, "pilotage.alerts.read")] },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      let token: string;
      try {
        token = extractBearerToken(request.headers.authorization);
      } catch {
        throw new SchoolSafeError(401, "AUTH_REQUIRED", "Authentification requise", false);
      }

      const { profileId, schoolId } = await dependencies.resolveProfileAndSchool(token);
      if (!profileId || !schoolId) {
        throw new SchoolSafeError(401, "AUTH_REQUIRED", "Profil ou école non trouvé", false);
      }

      const query = listAlertsSchema.parse(request.query);
      const result = await dependencies.service.list({ ...query, schoolId });
      return { data: result.data, count: result.count };
    },
  );

  app.post(
    "/pilotage/alerts/:id/acknowledge",
    { preHandler: [requirePermission(dependencies.access, "pilotage.alerts.manage")] },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      let token: string;
      try {
        token = extractBearerToken(request.headers.authorization);
      } catch {
        throw new SchoolSafeError(401, "AUTH_REQUIRED", "Authentification requise", false);
      }

      const { profileId, schoolId } = await dependencies.resolveProfileAndSchool(token);
      if (!profileId || !schoolId) {
        throw new SchoolSafeError(401, "AUTH_REQUIRED", "Profil ou école non trouvé", false);
      }

      const alertId = (request.params as Record<string, string>).id;
      const parsed = acknowledgeAlertSchema.parse(request.body);
      const result = await dependencies.service.acknowledge(alertId, { ...parsed, profileId });
      return { data: result };
    },
  );

  app.post(
    "/pilotage/alerts/:id/resolve",
    { preHandler: [requirePermission(dependencies.access, "pilotage.alerts.manage")] },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      let token: string;
      try {
        token = extractBearerToken(request.headers.authorization);
      } catch {
        throw new SchoolSafeError(401, "AUTH_REQUIRED", "Authentification requise", false);
      }

      const { profileId, schoolId } = await dependencies.resolveProfileAndSchool(token);
      if (!profileId || !schoolId) {
        throw new SchoolSafeError(401, "AUTH_REQUIRED", "Profil ou école non trouvé", false);
      }

      const alertId = (request.params as Record<string, string>).id;
      const parsed = resolveAlertSchema.parse(request.body);
      const result = await dependencies.service.resolve(alertId, { ...parsed, profileId });
      return { data: result };
    },
  );
}
