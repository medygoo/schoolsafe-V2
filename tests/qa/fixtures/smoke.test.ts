import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createTestSchool } from "./school.fixtures.js";
import { createReferenceProfiles, REFERENCE_PROFILES } from "./profiles.fixtures.js";
import { assignBaseRoles, BASE_ROLE_ASSIGNMENTS } from "./roles.fixtures.js";
import { assignScopes, BASE_SCOPES } from "./scopes.fixtures.js";
import { cleanupTestSchool } from "./cleanup.js";

const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpNqiIU";

const supabaseUrl = process.env.SUPABASE_URL ?? LOCAL_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_SUPABASE_SERVICE_ROLE_KEY;

const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

describe("QA fixtures smoke test", () => {
  let schoolId: string;
  let profiles: Record<string, string>;

  beforeAll(async () => {
    ({ schoolId } = await createTestSchool(serviceClient));
    profiles = await createReferenceProfiles(serviceClient, schoolId);
  }, 60000);

  afterAll(async () => {
    if (schoolId) {
      await cleanupTestSchool(serviceClient, schoolId);
    }
  }, 60000);

  it("creates 15 reference profiles", () => {
    expect(Object.keys(profiles)).toHaveLength(REFERENCE_PROFILES.length);
  });

  it("assigns base roles and scopes to every reference profile", async () => {
    for (const profileName of REFERENCE_PROFILES) {
      const profileId = profiles[profileName];
      const roleCodes = BASE_ROLE_ASSIGNMENTS[profileName] ?? [];
      await assignBaseRoles(serviceClient, profileId, roleCodes);

      const scopes = BASE_SCOPES[profileName] ?? [];
      await assignScopes(serviceClient, profileId, scopes);
    }
  }, 60000);

  it("persists the expected rows in profiles and scope_assignments", async () => {
    const { data: profileRows } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("school_id", schoolId);
    expect(profileRows).toHaveLength(REFERENCE_PROFILES.length);

    const { data: scopeRows } = await serviceClient
      .from("scope_assignments")
      .select("id")
      .in("profile_id", Object.values(profiles));
    expect(scopeRows?.length ?? 0).toBeGreaterThan(0);
  }, 30000);
});
