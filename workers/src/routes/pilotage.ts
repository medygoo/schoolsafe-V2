import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import type { PilotageService } from "../services/pilotage.js";
import type { AccessService } from "../services/access.js";
import { SchoolSafeError } from "../lib/errors.js";

const listAlertsSchema = z.object({
  status: z.string().optional(),
  severity: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export function createPilotageRouter(service: PilotageService, access: AccessService) {
  const router = new Hono();
  router.use(authMiddleware());

  router.get("/pilotage/dashboard", requirePermission(access, "pilotage.dashboard.read"), async (c) => {
    return c.json({ data: await service.loadDashboard(c.get("schoolId") as string) });
  });

  router.get("/pilotage/alerts", requirePermission(access, "pilotage.alerts.read"), async (c) => {
    const q = listAlertsSchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
    if (!q.success) throw new SchoolSafeError(400, "VALIDATION_INVALID", "Paramètres invalides", false);
    return c.json(await service.listAlerts(c.get("schoolId") as string, q.data));
  });

  router.post(
    "/pilotage/alerts/:id/acknowledge",
    requirePermission(access, "pilotage.alerts.manage"),
    async (c) => {
      return c.json({ data: await service.acknowledgeAlert(c.req.param("id")!, c.get("profileId") as string) });
    },
  );

  router.post("/pilotage/alerts/:id/resolve", requirePermission(access, "pilotage.alerts.manage"), async (c) => {
    const body = (await c.req.json()) as { note?: string };
    return c.json({ data: await service.resolveAlert(c.req.param("id")!, c.get("profileId") as string, body.note) });
  });

  return router;
}
