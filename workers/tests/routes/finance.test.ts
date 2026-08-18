import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { createFinanceRouter } from "../../src/routes/finance.js";
import type { FinanceService } from "../../src/services/finance.js";
import type { AccessService } from "../../src/services/access.js";

describe("finance routes", () => {
  it("lists fee structures", async () => {
    const service: FinanceService = { listFeeStructures: vi.fn().mockResolvedValue([{ id: "f1" }]) } as unknown as FinanceService;
    const access: AccessService = { hasPermission: vi.fn().mockResolvedValue(true), hasScope: vi.fn() };
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("token", "t");
      c.set("schoolId", "s1");
      await next();
    });
    app.route("/", createFinanceRouter(service, access));
    const res = await app.request("/finance/fee-structures", { headers: { Authorization: "Bearer t" } });
    expect(res.status).toBe(200);
  });
});
