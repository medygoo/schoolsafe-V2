import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { createPilotageRouter } from "../../src/routes/pilotage.js";
import type { PilotageService } from "../../src/services/pilotage.js";
import type { AccessService } from "../../src/services/access.js";

describe("pilotage routes", () => {
  it("loads dashboard", async () => {
    const service: PilotageService = { loadDashboard: vi.fn().mockResolvedValue({ counts: {} }) } as unknown as PilotageService;
    const access: AccessService = { hasPermission: vi.fn().mockResolvedValue(true), hasScope: vi.fn() };
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("token", "t");
      c.set("schoolId", "s1");
      await next();
    });
    app.route("/", createPilotageRouter(service, access));
    const res = await app.request("/pilotage/dashboard", { headers: { Authorization: "Bearer t" } });
    expect(res.status).toBe(200);
  });
});
