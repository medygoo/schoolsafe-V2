import { Hono } from "hono";
import { z } from "zod";
import { SchoolSafeError } from "../lib/errors.js";
import type { SetupService } from "../services/setup.js";

const validateTokenSchema = z.object({ token: z.string().min(1) });

export function createSetupRouter(service: SetupService) {
  const router = new Hono();

  router.get("/config", (c) => c.json(service.getConfig()));

  router.post("/setup/validate-token", async (c) => {
    const body = validateTokenSchema.safeParse(await c.req.json());
    if (!body.success) throw new SchoolSafeError(400, "VALIDATION_INVALID", "Données invalides", false);
    return c.json({ valid: service.validateToken(body.data.token) });
  });

  return router;
}
