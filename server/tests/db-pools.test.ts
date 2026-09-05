import { describe, expect, it } from "vitest";
import { createAuthPool, createBusinessPool } from "../src/db/pool.js";
import type { AppEnv } from "../src/config/env.js";

const BASE_ENV = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 8787,
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon",
  R2_BUCKET_CARDS: "cards",
  ZOHO_MAIL_SENDER_NAME: "SchoolSafe",
  ZOHO_MAIL_REGION: "com",
  VAPID_SUBJECT: "mailto:schoolsafe@example.com",
  DEFAULT_STAFF_PASSWORD: "SchoolSafe2026!",
  PGHOST: "127.0.0.1",
  PGPORT: 5432,
  PGDATABASE: "schoolsafe_test",
  PG_STATEMENT_TIMEOUT_MS: 15000,
  PG_POOL_MAX: 10,
} as unknown as AppEnv;

describe("pools séparés par rôle (verrou d'architecture)", () => {
  it("auth pool connects as the schoolsafe_auth credential", () => {
    const pool = createAuthPool({ ...BASE_ENV, PGAUTH_USER: "schoolsafe_auth", PGAUTH_PASSWORD: "secret-a" });
    expect((pool as unknown as { options: { user: string } }).options.user).toBe("schoolsafe_auth");
    expect((pool as unknown as { options: { database: string } }).options.database).toBe("schoolsafe_test");
  });

  it("business pool connects as the schoolsafe_api credential", () => {
    const pool = createBusinessPool({ ...BASE_ENV, PGUSER: "schoolsafe_api", PGPASSWORD: "secret-b" });
    expect((pool as unknown as { options: { user: string } }).options.user).toBe("schoolsafe_api");
  });

  it("the two pools never share credentials", () => {
    const auth = createAuthPool({ ...BASE_ENV, PGAUTH_USER: "schoolsafe_auth", PGAUTH_PASSWORD: "secret-a" });
    const business = createBusinessPool({ ...BASE_ENV, PGUSER: "schoolsafe_api", PGPASSWORD: "secret-b" });
    const authUser = (auth as unknown as { options: { user: string } }).options.user;
    const businessUser = (business as unknown as { options: { user: string } }).options.user;
    expect(authUser).not.toBe(businessUser);
  });

  it("fails closed when auth credentials are missing", () => {
    expect(() => createAuthPool(BASE_ENV)).toThrow("PGAUTH_USER");
  });

  it("fails closed when business credentials are missing", () => {
    expect(() => createBusinessPool(BASE_ENV)).toThrow("PGUSER");
  });

  it("fails closed when host or database is missing", () => {
    const incomplete = { ...BASE_ENV, PGHOST: undefined } as unknown as AppEnv;
    expect(() =>
      createAuthPool({ ...incomplete, PGAUTH_USER: "a", PGAUTH_PASSWORD: "b" }),
    ).toThrow("PGHOST");
  });
});
