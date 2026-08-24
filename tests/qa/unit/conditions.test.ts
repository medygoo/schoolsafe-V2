import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createTestSchool } from "../fixtures/school.fixtures.js";
import { cleanupTestSchool } from "../fixtures/cleanup.js";

const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblY8_IKo";
const LOCAL_SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpNqiIU";

const supabaseUrl = process.env.SUPABASE_URL ?? LOCAL_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? LOCAL_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_SUPABASE_SERVICE_ROLE_KEY;

const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function createUserClient(accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(email: string, password: string): Promise<string> {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`Sign in failed for ${email}: ${error?.message}`);
  return data.session.access_token;
}

async function createSingleProfile(
  client: SupabaseClient,
  schoolId: string,
  displayName: string,
): Promise<{ profileId: string; email: string; password: string }> {
  const email = `qa-${displayName}-${Date.now()}@schoolsafe.test`;
  const password = "TestPassword123!";
  const { data: authData, error: authError } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authData.user) throw new Error(`Auth user creation failed for ${displayName}: ${authError?.message}`);

  const { data: profileData, error: profileError } = await client
    .from("profiles")
    .insert({ auth_user_id: authData.user.id, school_id: schoolId, display_name: displayName })
    .select("id")
    .single();
  if (profileError || !profileData) throw new Error(`Profile creation failed for ${displayName}: ${profileError?.message}`);

  return { profileId: profileData.id as string, email, password };
}

async function ensurePermission(client: SupabaseClient, code: string, description: string): Promise<string> {
  const { data: existing, error: lookupError } = await client
    .from("permissions")
    .select("id")
    .eq("code", code)
    .single();
  if (lookupError && lookupError.code !== "PGRST116") {
    throw new Error(`Failed to lookup permission ${code}: ${lookupError.message}`);
  }
  if (existing) return existing.id as string;

  const { data, error } = await client.from("permissions").insert({ code, description }).select("id").single();
  if (error || !data) throw new Error(`Failed to create permission ${code}: ${error?.message}`);
  return data.id as string;
}

async function ensureRole(client: SupabaseClient, code: string, label: string): Promise<string> {
  const { data: existing, error: lookupError } = await client.from("roles").select("id").eq("code", code).single();
  if (lookupError && lookupError.code !== "PGRST116") {
    throw new Error(`Failed to lookup role ${code}: ${lookupError.message}`);
  }
  if (existing) return existing.id as string;

  const { data, error } = await client.from("roles").insert({ code, label }).select("id").single();
  if (error || !data) throw new Error(`Failed to create role ${code}: ${error?.message}`);
  return data.id as string;
}

async function grantPermission(
  client: SupabaseClient,
  roleId: string,
  permissionId: string,
  allowed: boolean,
): Promise<string> {
  const { data: existing } = await client
    .from("role_permission_grants")
    .select("id")
    .eq("role_id", roleId)
    .eq("permission_id", permissionId)
    .single();

  if (existing) {
    const { error } = await client
      .from("role_permission_grants")
      .update({ allowed })
      .eq("id", existing.id);
    if (error) throw new Error(`Failed to update grant: ${error.message}`);
    return existing.id as string;
  }

  const { data, error } = await client
    .from("role_permission_grants")
    .insert({ role_id: roleId, permission_id: permissionId, allowed })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to create grant: ${error?.message}`);
  return data.id as string;
}

async function addCondition(
  client: SupabaseClient,
  grantId: string,
  conditionType: string,
  params: object,
): Promise<void> {
  const { error } = await client.from("permission_conditions").insert({
    grant_id: grantId,
    condition_type: conditionType,
    condition_params: params,
  });
  if (error) throw new Error(`Failed to add condition ${conditionType}: ${error.message}`);
}

async function assignRole(client: SupabaseClient, profileId: string, roleId: string): Promise<void> {
  const { error } = await client.from("profile_roles").insert({ profile_id: profileId, role_id: roleId });
  if (error) throw new Error(`Failed to assign role: ${error.message}`);
}

describe("Condition system", () => {
  describe("has_condition RPC", () => {
    let schoolId: string;
    let profileId: string;
    let email: string;
    let password: string;

    beforeAll(async () => {
      ({ schoolId } = await createTestSchool(serviceClient));
      const user = await createSingleProfile(serviceClient, schoolId, "condition-tester");
      profileId = user.profileId;
      email = user.email;
      password = user.password;
    }, 60000);

    afterAll(async () => {
      if (schoolId) await cleanupTestSchool(serviceClient, schoolId);
    }, 60000);

    it("returns true for academic_year_active when an active year exists", async () => {
      await serviceClient.from("academic_years").insert({
        school_id: schoolId,
        label: "2025-2026",
        starts_on: "2025-09-01",
        ends_on: "2026-06-30",
        periods: "Trimestres",
        is_active: true,
      });

      const accessToken = await signIn(email, password);
      const userClient = createUserClient(accessToken);
      const { data, error } = await userClient.rpc("has_condition", {
        p_condition_type: "academic_year_active",
        p_params: {},
      });
      expect(error).toBeNull();
      expect(data).toBe(true);
    }, 30000);

    it("returns false for cash_register_open when no open register exists", async () => {
      const accessToken = await signIn(email, password);
      const userClient = createUserClient(accessToken);
      const { data, error } = await userClient.rpc("has_condition", {
        p_condition_type: "cash_register_open",
        p_params: { date: new Date().toISOString().slice(0, 10) },
      });
      expect(error).toBeNull();
      expect(data).toBe(false);
    }, 30000);

    it("returns true for cash_register_open when a register is open", async () => {
      await serviceClient.from("cash_registers").insert({
        school_id: schoolId,
        date: new Date().toISOString().slice(0, 10),
        status: "open",
        opened_by: profileId,
      });

      const accessToken = await signIn(email, password);
      const userClient = createUserClient(accessToken);
      const { data, error } = await userClient.rpc("has_condition", {
        p_condition_type: "cash_register_open",
        p_params: {},
      });
      expect(error).toBeNull();
      expect(data).toBe(true);
    }, 30000);
  });

  describe("has_permission with conditions", () => {
    let schoolId: string;
    let profileId: string;
    let email: string;
    let password: string;
    let permissionId: string;
    let roleId: string;

    beforeAll(async () => {
      ({ schoolId } = await createTestSchool(serviceClient));
      const user = await createSingleProfile(serviceClient, schoolId, "permission-condition-tester");
      profileId = user.profileId;
      email = user.email;
      password = user.password;

      permissionId = await ensurePermission(serviceClient, "qa.condition.test", "Permission de test conditions");
      roleId = await ensureRole(serviceClient, "qa-condition-role", "QA Condition Role");
      await assignRole(serviceClient, profileId, roleId);
    }, 60000);

    afterAll(async () => {
      if (schoolId) await cleanupTestSchool(serviceClient, schoolId);
    }, 60000);

    it("returns true when the grant has no condition and permission is allowed", async () => {
      await grantPermission(serviceClient, roleId, permissionId, true);

      const accessToken = await signIn(email, password);
      const userClient = createUserClient(accessToken);
      const { data, error } = await userClient.rpc("has_permission", { permission_code: "qa.condition.test" });
      expect(error).toBeNull();
      expect(data).toBe(true);
    }, 30000);

    it("returns false when an attached condition is not satisfied", async () => {
      const grantId = await grantPermission(serviceClient, roleId, permissionId, true);
      await serviceClient.from("permission_conditions").delete().eq("grant_id", grantId);
      await addCondition(serviceClient, grantId, "cash_register_open", {
        date: new Date().toISOString().slice(0, 10),
      });

      const accessToken = await signIn(email, password);
      const userClient = createUserClient(accessToken);
      const { data, error } = await userClient.rpc("has_permission", { permission_code: "qa.condition.test" });
      expect(error).toBeNull();
      expect(data).toBe(false);
    }, 30000);

    it("returns true when an attached condition is satisfied", async () => {
      const grantId = await grantPermission(serviceClient, roleId, permissionId, true);
      await serviceClient.from("permission_conditions").delete().eq("grant_id", grantId);
      await addCondition(serviceClient, grantId, "cash_register_open", {});

      await serviceClient.from("cash_registers").insert({
        school_id: schoolId,
        date: new Date().toISOString().slice(0, 10),
        status: "open",
        opened_by: profileId,
      });

      const accessToken = await signIn(email, password);
      const userClient = createUserClient(accessToken);
      const { data, error } = await userClient.rpc("has_permission", { permission_code: "qa.condition.test" });
      expect(error).toBeNull();
      expect(data).toBe(true);
    }, 30000);

    it("still returns false when another role denies the same permission", async () => {
      const allowGrantId = await grantPermission(serviceClient, roleId, permissionId, true);
      await serviceClient.from("permission_conditions").delete().eq("grant_id", allowGrantId);

      const denyRoleId = await ensureRole(serviceClient, "qa-condition-deny-role", "QA Condition Deny Role");
      await grantPermission(serviceClient, denyRoleId, permissionId, false);
      await assignRole(serviceClient, profileId, denyRoleId);

      const accessToken = await signIn(email, password);
      const userClient = createUserClient(accessToken);
      const { data, error } = await userClient.rpc("has_permission", { permission_code: "qa.condition.test" });
      expect(error).toBeNull();
      expect(data).toBe(false);
    }, 30000);
  });
});
