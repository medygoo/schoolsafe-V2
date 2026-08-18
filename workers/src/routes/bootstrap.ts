import { Hono } from "hono";
import { SchoolSafeError } from "../lib/errors.js";
import type { BootstrapService } from "../services/bootstrap.js";

export function createBootstrapRouter(service: BootstrapService) {
  const router = new Hono();

  router.post("/session/bootstrap", async (c) => {
    const auth = c.req.header("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      throw new SchoolSafeError(401, "AUTH_REQUIRED", "Authentification requise", false);
    }
    const token = auth.slice(7);
    const bootstrap = await service.load(token);
    if (!bootstrap) throw new SchoolSafeError(403, "PERMISSION_DENIED", "Profil indisponible", false);
    return c.json(bootstrap);
  });

  return router;
}
