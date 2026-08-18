import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { SchoolSafeError } from "../../http/errors.js";
import { extractBearerToken } from "../../auth/session.js";
import type { FinanceReportsService } from "./service.js";
import { dailyReportQuerySchema, closeCashRegisterSchema } from "./schema.js";
import { requirePermission } from "../../access/guard.js";
import type { AccessService } from "../../access/service.js";

export type ResolveProfileIdAndSchool = (token: string) => Promise<{ profileId: string | null; schoolId: string | null }>;

export type FinanceReportsRouteDependencies = {
  service: FinanceReportsService;
  resolveProfileAndSchool: ResolveProfileIdAndSchool;
  access: AccessService;
};

async function authenticate(request: FastifyRequest, resolve: ResolveProfileIdAndSchool) {
  let token: string;
  try {
    token = extractBearerToken(request.headers.authorization);
  } catch {
    throw new SchoolSafeError(401, "AUTH_REQUIRED", "Authentification requise", false);
  }
  const { profileId, schoolId } = await resolve(token);
  if (!profileId || !schoolId) {
    throw new SchoolSafeError(401, "AUTH_REQUIRED", "Profil ou école non trouvé", false);
  }
  return { profileId, schoolId };
}

export function registerFinanceReportsRoutes(app: FastifyInstance, dependencies: FinanceReportsRouteDependencies): void {
  app.get(
    "/finance/receipts/:paymentId",
    { preHandler: [requirePermission(dependencies.access, "finance.receipt.read")] },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { schoolId } = await authenticate(request, dependencies.resolveProfileAndSchool);
      const { paymentId } = request.params as { paymentId: string };
      const result = await dependencies.service.getReceiptData(schoolId, paymentId);
      if (!result) {
        throw new SchoolSafeError(404, "NOT_FOUND", "Reçu introuvable", false);
      }
      return { data: result };
    },
  );

  app.get(
    "/finance/reports/daily",
    { preHandler: [requirePermission(dependencies.access, "finance.report.read")] },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { schoolId } = await authenticate(request, dependencies.resolveProfileAndSchool);
      const parsed = dailyReportQuerySchema.parse(request.query);
      const result = await dependencies.service.getDailyReport(schoolId, parsed.date);
      return { data: result };
    },
  );

  app.post(
    "/finance/cash-register/close",
    { preHandler: [requirePermission(dependencies.access, "finance.cash_register.close")] },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { profileId, schoolId } = await authenticate(request, dependencies.resolveProfileAndSchool);
      const parsed = closeCashRegisterSchema.parse(request.body);
      const result = await dependencies.service.closeCashRegister(schoolId, profileId, parsed);
      return { data: result };
    },
  );
}
