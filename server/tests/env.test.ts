import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/config/env.js";

describe("parseEnv", () => {
  it("refuse une configuration serveur sans URL Supabase", () => {
    expect(() => parseEnv({ NODE_ENV: "test" })).toThrow(/SUPABASE_URL/);
  });

  it("applique les valeurs publiques locales sans exiger de secret privilégié", () => {
    const env = parseEnv({
      NODE_ENV: "test",
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_ANON_KEY: "local-test-public-key"
    });
    expect(env.HOST).toBe("127.0.0.1");
    expect(env.PORT).toBe(8787);
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  });
});
