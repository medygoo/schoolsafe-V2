import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import type { SchoolService } from "../services/school.js";
import type { AccessService } from "../services/access.js";
import { SchoolSafeError } from "../lib/errors.js";

const updateSettingsSchema = z.object({
  identity: z.object({
    name: z.string().min(1).optional(),
    name_en: z.string().optional(),
    legal_name: z.string().optional(),
    school_type: z.string().optional(),
    approval_code: z.string().optional(),
  }).optional(),
  brand: z.object({
    primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    document_footer: z.string().optional(),
    logo_path: z.string().optional(),
  }).optional(),
  contact: z.record(z.string().nullable()).optional(),
});

const toggleCycleSchema = z.object({ is_active: z.boolean() });

export function createSchoolRouter(service: SchoolService, access: AccessService) {
  const router = new Hono();
  router.use(authMiddleware());

  router.get("/school/settings", requirePermission(access, "school.manage"), async (c) => {
    const schoolId = c.get("schoolId") as string;
    return c.json({ data: await service.getSettings(schoolId) });
  });

  router.put("/school/settings", requirePermission(access, "school.manage"), async (c) => {
    const schoolId = c.get("schoolId") as string;
    const body = updateSettingsSchema.safeParse(await c.req.json());
    if (!body.success) throw new SchoolSafeError(400, "VALIDATION_INVALID", "Données invalides", false);
    return c.json({ data: await service.updateSettings(schoolId, body.data) });
  });

  router.get("/school/staff", requirePermission(access, "staff.manage"), async (c) => {
    const schoolId = c.get("schoolId") as string;
    return c.json({ data: await service.listStaff(schoolId) });
  });

  router.get("/school/academic-years", requirePermission(access, "school.manage"), async (c) => {
    const schoolId = c.get("schoolId") as string;
    return c.json({ data: await service.listAcademicYears(schoolId) });
  });

  router.post("/school/academic-years/:id/activate", requirePermission(access, "school.manage"), async (c) => {
    const schoolId = c.get("schoolId") as string;
    await service.activateAcademicYear(schoolId, c.req.param("id"));
    return c.json({ status: "ok" });
  });

  router.get("/school/cycles", requirePermission(access, "school.manage"), async (c) => {
    const schoolId = c.get("schoolId") as string;
    return c.json({ data: await service.listCycles(schoolId) });
  });

  router.put("/school/cycles/:key/toggle", requirePermission(access, "school.manage"), async (c) => {
    const schoolId = c.get("schoolId") as string;
    const body = toggleCycleSchema.safeParse(await c.req.json());
    if (!body.success) throw new SchoolSafeError(400, "VALIDATION_INVALID", "Données invalides", false);
    await service.toggleCycle(schoolId, c.req.param("key"), body.data.is_active);
    return c.json({ status: "ok" });
  });

  return router;
}
