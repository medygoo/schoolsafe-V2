import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { createSchoolRouter } from "../../src/routes/school.js";
import type { SchoolService } from "../../src/services/school.js";
import type { AccessService } from "../../src/services/access.js";

describe("school routes", () => {
  it("returns settings", async () => {
    const service: SchoolService = {
      getSettings: vi.fn().mockResolvedValue({ identity: { name: "École Test" } }),
    } as unknown as SchoolService;
    const access: AccessService = { hasPermission: vi.fn().mockResolvedValue(true), hasScope: vi.fn() };
    const app = new Hono();
    app.use("*", async (c, next) => { c.set("token", "t"); c.set("schoolId", "s1"); await next(); });
    app.route("/", createSchoolRouter(service, access));
    const res = await app.request("/school/settings", { headers: { Authorization: "Bearer t" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { identity: { name: "École Test" } } });
  });
});
