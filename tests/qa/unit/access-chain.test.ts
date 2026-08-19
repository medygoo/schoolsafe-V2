import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createTestSchool } from "../fixtures/school.fixtures.js";
import { assignBaseRoles } from "../fixtures/roles.fixtures.js";
import { assignScopes } from "../fixtures/scopes.fixtures.js";
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
): Promise<void> {
  const { error } = await client
    .from("role_permission_grants")
    .upsert({ role_id: roleId, permission_id: permissionId, allowed }, { onConflict: "role_id,permission_id" });
  if (error) throw new Error(`Failed to grant permission: ${error.message}`);
}

describe("Access chain: USER → SCHOOL → ROLE → PERMISSION → SCOPE → EXCEPTION", () => {
  describe("USER → SCHOOL isolation", () => {
    let schoolAId: string;
    let schoolBId: string;
    let userAEmail: string;
    let userAPassword: string;

    beforeAll(async () => {
      ({ schoolId: schoolAId } = await createTestSchool(serviceClient));
      ({ schoolId: schoolBId } = await createTestSchool(serviceClient));
      const userA = await createSingleProfile(serviceClient, schoolAId, "school-a-user");
      await createSingleProfile(serviceClient, schoolBId, "school-b-user");
      userAEmail = userA.email;
      userAPassword = userA.password;
    }, 60000);

    afterAll(async () => {
      if (schoolBId) await cleanupTestSchool(serviceClient, schoolBId);
      if (schoolAId) await cleanupTestSchool(serviceClient, schoolAId);
    }, 60000);

    it("blocks a profile from school A from accessing profiles in school B", async () => {
      const accessToken = await signIn(userAEmail, userAPassword);
      const userClient = createUserClient(accessToken);
      const { data, error } = await userClient.from("profiles").select("id").eq("school_id", schoolBId);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    }, 30000);
  });

  describe("Explicit DENY override", () => {
    let schoolId: string;
    let profileId: string;
    let email: string;
    let password: string;

    beforeAll(async () => {
      ({ schoolId } = await createTestSchool(serviceClient));
      const user = await createSingleProfile(serviceClient, schoolId, "deny-override-user");
      profileId = user.profileId;
      email = user.email;
      password = user.password;

      const permissionId = await ensurePermission(serviceClient, "school.manage", "Gérer l'école");
      const allowRoleId = await ensureRole(serviceClient, "qa-allow", "QA Allow");
      const denyRoleId = await ensureRole(serviceClient, "qa-deny", "QA Deny");

      await grantPermission(serviceClient, allowRoleId, permissionId, true);
      await grantPermission(serviceClient, denyRoleId, permissionId, false);
      await assignBaseRoles(serviceClient, profileId, ["qa-allow", "qa-deny"]);
    }, 60000);

    afterAll(async () => {
      if (schoolId) await cleanupTestSchool(serviceClient, schoolId);
    }, 60000);

    it("returns false when one role allows and another role denies the same permission", async () => {
      const accessToken = await signIn(email, password);
      const userClient = createUserClient(accessToken);
      const { data, error } = await userClient.rpc("has_permission", { permission_code: "school.manage" });
      expect(error).toBeNull();
      expect(data).toBe(false);
    }, 30000);
  });

  describe("SCOPE check — teacher assigned classes", () => {
    let schoolId: string;
    let profileId: string;
    let email: string;
    let password: string;
    let classXId: string;
    let classYId: string;

    beforeAll(async () => {
      ({ schoolId } = await createTestSchool(serviceClient));
      const user = await createSingleProfile(serviceClient, schoolId, "teacher-scope-user");
      profileId = user.profileId;
      email = user.email;
      password = user.password;

      classXId = crypto.randomUUID();
      classYId = crypto.randomUUID();
      await assignBaseRoles(serviceClient, profileId, ["teacher"]);
      await assignScopes(serviceClient, profileId, [{ type: "assigned_classes", id: classXId }]);
    }, 60000);

    afterAll(async () => {
      if (schoolId) await cleanupTestSchool(serviceClient, schoolId);
    }, 60000);

    it("returns true for an assigned class", async () => {
      const accessToken = await signIn(email, password);
      const userClient = createUserClient(accessToken);
      const { data, error } = await userClient.rpc("has_scope", {
        requested_scope_type: "assigned_classes",
        requested_scope_id: classXId,
      });
      expect(error).toBeNull();
      expect(data).toBe(true);
    }, 30000);

    it("returns false for a non-assigned class", async () => {
      const accessToken = await signIn(email, password);
      const userClient = createUserClient(accessToken);
      const { data, error } = await userClient.rpc("has_scope", {
        requested_scope_type: "assigned_classes",
        requested_scope_id: classYId,
      });
      expect(error).toBeNull();
      expect(data).toBe(false);
    }, 30000);
  });

  describe("SCOPE check — parent own children", () => {
    let schoolId: string;
    let profileId: string;
    let email: string;
    let password: string;
    let childAId: string;
    let childBId: string;

    beforeAll(async () => {
      ({ schoolId } = await createTestSchool(serviceClient));
      const user = await createSingleProfile(serviceClient, schoolId, "parent-scope-user");
      profileId = user.profileId;
      email = user.email;
      password = user.password;

      childAId = crypto.randomUUID();
      childBId = crypto.randomUUID();
      await assignBaseRoles(serviceClient, profileId, ["parent"]);
      await assignScopes(serviceClient, profileId, [{ type: "own_children", id: childAId }]);
    }, 60000);

    afterAll(async () => {
      if (schoolId) await cleanupTestSchool(serviceClient, schoolId);
    }, 60000);

    it("returns true for an own child", async () => {
      const accessToken = await signIn(email, password);
      const userClient = createUserClient(accessToken);
      const { data, error } = await userClient.rpc("has_scope", {
        requested_scope_type: "own_children",
        requested_scope_id: childAId,
      });
      expect(error).toBeNull();
      expect(data).toBe(true);
    }, 30000);

    it("returns false for another child", async () => {
      const accessToken = await signIn(email, password);
      const userClient = createUserClient(accessToken);
      const { data, error } = await userClient.rpc("has_scope", {
        requested_scope_type: "own_children",
        requested_scope_id: childBId,
      });
      expect(error).toBeNull();
      expect(data).toBe(false);
    }, 30000);
  });

  describe("ROLE without permission", () => {
    let schoolId: string;
    let email: string;
    let password: string;

    beforeAll(async () => {
      ({ schoolId } = await createTestSchool(serviceClient));
      const user = await createSingleProfile(serviceClient, schoolId, "cashier-user");
      email = user.email;
      password = user.password;
      await ensurePermission(serviceClient, "school.manage", "Gérer l'école");
      await assignBaseRoles(serviceClient, user.profileId, ["cashier"]);
    }, 60000);

    afterAll(async () => {
      if (schoolId) await cleanupTestSchool(serviceClient, schoolId);
    }, 60000);

    it("returns false for a cashier calling school.manage", async () => {
      const accessToken = await signIn(email, password);
      const userClient = createUserClient(accessToken);
      const { data, error } = await userClient.rpc("has_permission", { permission_code: "school.manage" });
      expect(error).toBeNull();
      expect(data).toBe(false);
    }, 30000);
  });
});
