import type { FastifyInstance } from "fastify";
import { requirePermission } from "../access/guard.js";
import type { AccessService } from "../access/service.js";
import { SchoolSafeError } from "../http/errors.js";
import type { SchoolService } from "./service.js";
import {
  inviteStaffSchema,
  toggleStaffActiveSchema,
  updateSchoolSettingsSchema,
  updateStaffRolesSchema,
} from "./schema.js";

export interface SchoolRouteDependencies {
  service: SchoolService;
  resolveProfileAndSchool: (token: string) => Promise<{ profileId: string | null; schoolId: string | null }>;
  access: AccessService;
}

export function registerSchoolRoutes(app: FastifyInstance, deps: SchoolRouteDependencies): void {
  const { service, resolveProfileAndSchool, access } = deps;

  app.get(
    "/school/settings",
    { preHandler: [requirePermission(access, "school.manage")] },
    async (request, reply) => {
      const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
      const { schoolId } = await resolveProfileAndSchool(token);
      if (!schoolId) throw new SchoolSafeError(403, "SCHOOL_NOT_FOUND", "École introuvable", false);
      const settings = await service.getSettings(schoolId);
      reply.send(settings);
    },
  );

  app.put(
    "/school/settings",
    { preHandler: [requirePermission(access, "school.manage")] },
    async (request, reply) => {
      const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
      const { schoolId } = await resolveProfileAndSchool(token);
      if (!schoolId) throw new SchoolSafeError(403, "SCHOOL_NOT_FOUND", "École introuvable", false);
      const payload = updateSchoolSettingsSchema.parse(request.body);
      const settings = await service.updateSettings(schoolId, payload);
      reply.send(settings);
    },
  );

  app.get(
    "/school/staff",
    { preHandler: [requirePermission(access, "staff.manage")] },
    async (request, reply) => {
      const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
      const { schoolId } = await resolveProfileAndSchool(token);
      if (!schoolId) throw new SchoolSafeError(403, "SCHOOL_NOT_FOUND", "École introuvable", false);
      const staff = await service.listStaff(schoolId);
      reply.send(staff);
    },
  );

  app.post(
    "/school/staff/invite",
    { preHandler: [requirePermission(access, "staff.manage")] },
    async (request, reply) => {
      const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
      const { schoolId } = await resolveProfileAndSchool(token);
      if (!schoolId) throw new SchoolSafeError(403, "SCHOOL_NOT_FOUND", "École introuvable", false);
      const payload = inviteStaffSchema.parse(request.body);
      const result = await service.inviteStaff(schoolId, payload);
      reply.status(201).send(result);
    },
  );

  app.put(
    "/school/staff/:id/roles",
    { preHandler: [requirePermission(access, "staff.manage")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const payload = updateStaffRolesSchema.parse(request.body);
      await service.updateStaffRoles(id, payload);
      reply.send({ status: "ok" });
    },
  );

  app.post(
    "/school/staff/:id/toggle",
    { preHandler: [requirePermission(access, "staff.manage")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const payload = toggleStaffActiveSchema.parse(request.body);
      await service.toggleStaffActive(id, payload);
      reply.send({ status: "ok" });
    },
  );

  app.get(
    "/school/roles",
    { preHandler: [requirePermission(access, "staff.manage")] },
    async (_request, reply) => {
      const roles = await service.listRoles();
      reply.send(roles);
    },
  );

  app.get(
    "/school/permissions",
    { preHandler: [requirePermission(access, "staff.manage")] },
    async (_request, reply) => {
      const permissions = await service.listPermissions();
      reply.send(permissions);
    },
  );
}
