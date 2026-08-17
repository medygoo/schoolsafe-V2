import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { createWriteStream, mkdirSync, statSync, unlinkSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { requirePermission } from "../access/guard.js";
import type { AccessService } from "../access/service.js";
import { SchoolSafeError } from "../http/errors.js";
import type { SchoolService } from "./service.js";
import {
  createAcademicYearSchema,
  inviteStaffSchema,
  toggleCycleSchema,
  toggleStaffActiveSchema,
  updateAcademicYearSchema,
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

  app.get(
    "/school/academic-years",
    { preHandler: [requirePermission(access, "school.manage")] },
    async (request, reply) => {
      const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
      const { schoolId } = await resolveProfileAndSchool(token);
      if (!schoolId) throw new SchoolSafeError(403, "SCHOOL_NOT_FOUND", "École introuvable", false);
      const years = await service.listAcademicYears(schoolId);
      reply.send(years);
    },
  );

  app.post(
    "/school/academic-years",
    { preHandler: [requirePermission(access, "school.manage")] },
    async (request, reply) => {
      const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
      const { schoolId } = await resolveProfileAndSchool(token);
      if (!schoolId) throw new SchoolSafeError(403, "SCHOOL_NOT_FOUND", "École introuvable", false);
      const payload = createAcademicYearSchema.parse(request.body);
      const result = await service.createAcademicYear(schoolId, payload);
      reply.status(201).send(result);
    },
  );

  app.put(
    "/school/academic-years/:id",
    { preHandler: [requirePermission(access, "school.manage")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
      const { schoolId } = await resolveProfileAndSchool(token);
      if (!schoolId) throw new SchoolSafeError(403, "SCHOOL_NOT_FOUND", "École introuvable", false);
      const payload = updateAcademicYearSchema.parse(request.body);
      await service.updateAcademicYear(schoolId, id, payload);
      reply.send({ status: "ok" });
    },
  );

  app.post(
    "/school/academic-years/:id/activate",
    { preHandler: [requirePermission(access, "school.manage")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
      const { schoolId } = await resolveProfileAndSchool(token);
      if (!schoolId) throw new SchoolSafeError(403, "SCHOOL_NOT_FOUND", "École introuvable", false);
      await service.activateAcademicYear(schoolId, id);
      reply.send({ status: "ok" });
    },
  );

  app.get(
    "/school/cycles",
    { preHandler: [requirePermission(access, "school.manage")] },
    async (request, reply) => {
      const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
      const { schoolId } = await resolveProfileAndSchool(token);
      if (!schoolId) throw new SchoolSafeError(403, "SCHOOL_NOT_FOUND", "École introuvable", false);
      const cycles = await service.listCycles(schoolId);
      reply.send(cycles);
    },
  );

  app.put(
    "/school/cycles/:key/toggle",
    { preHandler: [requirePermission(access, "school.manage")] },
    async (request, reply) => {
      const { key } = request.params as { key: string };
      const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
      const { schoolId } = await resolveProfileAndSchool(token);
      if (!schoolId) throw new SchoolSafeError(403, "SCHOOL_NOT_FOUND", "École introuvable", false);
      const payload = toggleCycleSchema.parse(request.body);
      await service.toggleCycle(schoolId, key, payload);
      reply.send({ status: "ok" });
    },
  );

  app.post(
    "/school/logo",
    { preHandler: [requirePermission(access, "school.manage")] },
    async (request, reply) => {
      const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
      const { schoolId } = await resolveProfileAndSchool(token);
      if (!schoolId) throw new SchoolSafeError(403, "SCHOOL_NOT_FOUND", "École introuvable", false);

      const file = await request.file();
      if (!file) throw new SchoolSafeError(400, "FILE_MISSING", "Aucun fichier reçu", false);

      const allowed = ["image/png", "image/jpeg", "image/webp"];
      if (!allowed.includes(file.mimetype)) {
        throw new SchoolSafeError(400, "FILE_INVALID", "Format non supporté (PNG, JPG, WEBP)", false);
      }

      const ext = file.filename.split(".").pop() || "png";
      const filename = `${randomUUID()}.${ext}`;
      const uploadDir = path.resolve(process.cwd(), "server/uploads/logos");
      mkdirSync(uploadDir, { recursive: true });
      const filepath = path.join(uploadDir, filename);
      await pipeline(file.file, createWriteStream(filepath));

      const stats = statSync(filepath);
      if (stats.size > 2 * 1024 * 1024) {
        unlinkSync(filepath);
        throw new SchoolSafeError(400, "FILE_TOO_LARGE", "Fichier trop volumineux (max 2 Mo)", false);
      }

      const logoPath = `/uploads/logos/${filename}`;
      await service.saveLogoPath(schoolId, logoPath);
      reply.send({ logo_path: logoPath });
    },
  );
}
