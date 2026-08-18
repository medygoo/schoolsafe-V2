import { describe, it, expect } from "vitest";
import worker from "../../src/index.js";

describe("health", () => {
  it("returns ok", async () => {
    const req = new Request("http://localhost/health");
    const res = await worker.fetch(req, {
      SUPABASE_URL: "http://localhost:54321",
      SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      ALLOWED_ORIGINS: "http://localhost:4175",
    } as unknown as Record<string, unknown>);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
