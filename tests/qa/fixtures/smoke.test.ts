import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createTestSchool } from "./school.fixtures.js";
import { createReferenceProfiles, REFERENCE_PROFILES } from "./profiles.fixtures.js";
import { assignBaseRoles, BASE_ROLE_ASSIGNMENTS } from "./roles.fixtures.js";
import { assignScopes, BASE_SCOPES } from "./scopes.fixtures.js";
import { cleanupTestSchool } from "./cleanup.js";

const serviceClient = createClient(
  process.env.SUPABASE_URL ?? "http://127.0.0.1:54321",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
);

describe("QA fixtures smoke test", () => {
  it("creates a school, 15 reference profiles, roles and scopes", async () => {
    const { schoolId } = await createTestSchool(serviceClient);
    expect(schoolId).toBeDefined();

    const profiles = await createReferenceProfiles(serviceClient, schoolId);
    expect(Object.keys(profiles)).toHaveLength(REFERENCE_PROFILES.length);

    for (const profileName of REFERENCE_PROFILES) {
      const profileId = profiles[profileName];
      const roleCodes = BASE_ROLE_ASSIGNMENTS[profileName] ?? [];
      await assignBaseRoles(serviceClient, profileId, roleCodes);

      const scopes = BASE_SCOPES[profileName] ?? [];
      await assignScopes(serviceClient, profileId, scopes);
    }

    // Verify created rows
    const { data: profileRows } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("school_id", schoolId);
    expect(profileRows).toHaveLength(REFERENCE_PROFILES.length);

    const { data: scopeRows } = await serviceClient
      .from("scope_assignments")
      .select("id")
      .in(
        "profile_id",
        Object.values(profiles),
      );
    expect(scopeRows?.length ?? 0).toBeGreaterThan(0);

    await cleanupTestSchool(serviceClient, schoolId);

    const { data: remainingProfiles } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("school_id", schoolId);
    expect(remainingProfiles).toHaveLength(0);
  }, 60000);
});
