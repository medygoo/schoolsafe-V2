import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { requirePermission } from "../../src/middleware/permission.js";
import { SchoolSafeError } from "../../src/lib/errors.js";
import type { AccessService } from "../../src/services/access.js";

function createApp(access: AccessService, permission: string) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof SchoolSafeError) {
      return c.json(
        { code: err.code, message: err.publicMessage, request_id: "test", retryable: err.retryable },
        err.statusCode as ContentfulStatusCode,
      );
    }
    return c.json({ code: "INTERNAL_ERROR", message: "Erreur interne", request_id: "test", retryable: false }, 500);
  });
  app.get("/test", requirePermission(access, permission), (c) => c.json({ ok: true }));
  return app;
}

describe("requirePermission", () => {
  it("returns 401 without token", async () => {
    const access: AccessService = {
      hasPermission: vi.fn().mockResolvedValue(true),
      hasScope: vi.fn().mockResolvedValue(true),
    };
    const app = createApp(access, "school.manage");
    const res = await app.request("/test");
    expect(res.status).toBe(401);
  });

  it("returns 403 when permission is denied", async () => {
    const access: AccessService = {
      hasPermission: vi.fn().mockResolvedValue(false),
      hasScope: vi.fn().mockResolvedValue(true),
    };
    const app = createApp(access, "school.manage");
    const res = await app.request("/test", { headers: { Authorization: "Bearer token" } });
    expect(res.status).toBe(403);
  });

  it("passes when permission is granted", async () => {
    const access: AccessService = {
      hasPermission: vi.fn().mockResolvedValue(true),
      hasScope: vi.fn().mockResolvedValue(true),
    };
    const app = createApp(access, "school.manage");
    const res = await app.request("/test", { headers: { Authorization: "Bearer token" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
