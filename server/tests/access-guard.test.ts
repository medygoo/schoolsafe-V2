import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import type { AccessService } from "../src/access/service.js";

function accessService(mock: {
  permission?: boolean;
  scope?: boolean;
}): AccessService {
  return {
    hasPermission: vi.fn().mockResolvedValue(mock.permission ?? true),
    hasScope: vi.fn().mockResolvedValue(mock.scope ?? true),
  };
}

describe("Access guard", () => {
  it("returns 401 when authorization header is missing", async () => {
    const app = buildApp({ testRoutes: true, access: accessService({ permission: true }) });
    const response = await app.inject({ method: "GET", url: "/__test/protected" });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: "AUTH_REQUIRED" });
    await app.close();
  });

  it("returns 401 when authorization header is not a bearer token", async () => {
    const app = buildApp({ testRoutes: true, access: accessService({ permission: true }) });
    const response = await app.inject({
      method: "GET",
      url: "/__test/protected",
      headers: { authorization: "Basic dXNlcjpwYXNz" },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: "AUTH_REQUIRED" });
    await app.close();
  });

  it("returns 403 when permission is denied", async () => {
    const app = buildApp({ testRoutes: true, access: accessService({ permission: false }) });
    const response = await app.inject({
      method: "GET",
      url: "/__test/protected",
      headers: { authorization: "Bearer valid-token" },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: "ACCESS_DENIED" });
    await app.close();
  });

  it("returns 403 when scope is denied", async () => {
    const app = buildApp({ testRoutes: true, access: accessService({ permission: true, scope: false }) });
    const response = await app.inject({
      method: "GET",
      url: "/__test/protected",
      headers: { authorization: "Bearer valid-token" },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: "SCOPE_DENIED" });
    await app.close();
  });

  it("returns 200 when permission and scope are granted", async () => {
    const app = buildApp({ testRoutes: true, access: accessService({ permission: true, scope: true }) });
    const response = await app.inject({
      method: "GET",
      url: "/__test/protected",
      headers: { authorization: "Bearer valid-token" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    await app.close();
  });
});
