import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { createPedagogyRouter } from "../../src/routes/pedagogy.js";
import type { PedagogyService } from "../../src/services/pedagogy.js";
import type { AccessService } from "../../src/services/access.js";

describe("pedagogy routes", () => {
  it("lists classes", async () => {
    const service: PedagogyService = { listClasses: vi.fn().mockResolvedValue([{ id: "c1" }]) } as unknown as PedagogyService;
    const access: AccessService = { hasPermission: vi.fn().mockResolvedValue(true), hasScope: vi.fn() };
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("token", "t");
      c.set("schoolId", "s1");
      await next();
    });
    app.route("/", createPedagogyRouter(service, access));
    const res = await app.request("/pedagogy/classes", { headers: { Authorization: "Bearer t" } });
    expect(res.status).toBe(200);
  });
});
