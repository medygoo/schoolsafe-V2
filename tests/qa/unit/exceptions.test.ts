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
): Promise<void> {
  const { error } = await client
    .from("role_permission_grants")
    .upsert({ role_id: roleId, permission_id: permissionId, allowed }, { onConflict: "role_id,permission_id" });
  if (error) throw new Error(`Failed to grant permission: ${error.message}`);
}

async function assignRole(client: SupabaseClient, profileId: string, roleId: string): Promise<void> {
  const { error } = await client.from("profile_roles").insert({ profile_id: profileId, role_id: roleId });
  if (error) throw new Error(`Failed to assign role: ${error.message}`);
}

async function addException(
  client: SupabaseClient,
  profileId: string,
  permissionCode: string,
  allowed: boolean,
  grantedBy: string,
  overrides?: { reason?: string; expiresAt?: string },
): Promise<void> {
  const { error } = await client.from("profile_permission_exceptions").insert({
    profile_id: profileId,
    permission_code: permissionCode,
    allowed,
    reason: overrides?.reason ?? "QA test exception",
    granted_by: grantedBy,
    expires_at: overrides?.expiresAt ?? null,
  });
  if (error) throw new Error(`Failed to add exception: ${error.message}`);
}

async function removeException(client: SupabaseClient, profileId: string, permissionCode: string): Promise<void> {
  const { error } = await client
    .from("profile_permission_exceptions")
    .delete()
    .eq("profile_id", profileId)
    .eq("permission_code", permissionCode);
  if (error) throw new Error(`Failed to remove exception: ${error.message}`);
}

describe("Individual permission exceptions", () => {
  describe("Exception ALLOW grants a permission not covered by roles", () => {
    let schoolId: string;
    let profileId: string;
    let adminProfileId: string;
    let email: string;
    let password: string;

    beforeAll(async () => {
      ({ schoolId } = await createTestSchool(serviceClient));
      const admin = await createSingleProfile(serviceClient, schoolId, "exception-admin");
      adminProfileId = admin.profileId;
      const user = await createSingleProfile(serviceClient, schoolId, "exception-allow-user");
      profileId = user.profileId;
      email = user.email;
      password = user.password;

      await ensurePermission(serviceClient, "qa.exception.allow", "Permission de test exception ALLOW");
    }, 60000);

    afterAll(async () => {
      if (schoolId) await cleanupTestSchool(serviceClient, schoolId);
    }, 60000);

    it("returns false before the exception is added", async () => {
      const accessToken = await signIn(email, password);
      const userClient = createUserClient(accessToken);
      const { data, error } = await userClient.rpc("has_permission", { permission_code: "qa.exception.allow" });
      expect(error).toBeNull();
      expect(data).toBe(false);
    }, 30000);

    it("returns true after an active ALLOW exception is added", async () => {
      await addException(serviceClient, profileId, "qa.exception.allow", true, adminProfileId);

      const accessToken = await signIn(email, password);
      const userClient = createUserClient(accessToken);
      const { data, error } = await userClient.rpc("has_permission", { permission_code: "qa.exception.allow" });
      expect(error).toBeNull();
      expect(data).toBe(true);
    }, 30000);
  });

  describe("Exception DENY removes a permission covered by roles", () => {
    let schoolId: string;
    let profileId: string;
    let adminProfileId: string;
    let email: string;
    let password: string;
    let permissionId: string;
    let roleId: string;

    beforeAll(async () => {
      ({ schoolId } = await createTestSchool(serviceClient));
      const admin = await createSingleProfile(serviceClient, schoolId, "exception-deny-admin");
      adminProfileId = admin.profileId;
      const user = await createSingleProfile(serviceClient, schoolId, "exception-deny-user");
      profileId = user.profileId;
      email = user.email;
      password = user.password;

      permissionId = await ensurePermission(serviceClient, "qa.exception.deny", "Permission de test exception DENY");
      roleId = await ensureRole(serviceClient, "qa-exception-deny-role", "QA Exception Deny Role");
      await grantPermission(serviceClient, roleId, permissionId, true);
      await assignRole(serviceClient, profileId, roleId);
    }, 60000);

    afterAll(async () => {
      if (schoolId) await cleanupTestSchool(serviceClient, schoolId);
    }, 60000);

    it("returns true before the exception is added", async () => {
      const accessToken = await signIn(email, password);
      const userClient = createUserClient(accessToken);
      const { data, error } = await userClient.rpc("has_permission", { permission_code: "qa.exception.deny" });
      expect(error).toBeNull();
      expect(data).toBe(true);
    }, 30000);

    it("returns false after an active DENY exception is added", async () => {
      await addException(serviceClient, profileId, "qa.exception.deny", false, adminProfileId);

      const accessToken = await signIn(email, password);
      const userClient = createUserClient(accessToken);
      const { data, error } = await userClient.rpc("has_permission", { permission_code: "qa.exception.deny" });
      expect(error).toBeNull();
      expect(data).toBe(false);
    }, 30000);
  });

  describe("Expired exception is ignored", () => {
    let schoolId: string;
    let profileId: string;
    let adminProfileId: string;
    let email: string;
    let password: string;
    let permissionId: string;
    let roleId: string;

    beforeAll(async () => {
      ({ schoolId } = await createTestSchool(serviceClient));
      const admin = await createSingleProfile(serviceClient, schoolId, "exception-expiry-admin");
      adminProfileId = admin.profileId;
      const user = await createSingleProfile(serviceClient, schoolId, "exception-expiry-user");
      profileId = user.profileId;
      email = user.email;
      password = user.password;

      permissionId = await ensurePermission(serviceClient, "qa.exception.expiry", "Permission de test exception expirée");
      roleId = await ensureRole(serviceClient, "qa-exception-expiry-role", "QA Exception Expiry Role");
      await grantPermission(serviceClient, roleId, permissionId, true);
      await assignRole(serviceClient, profileId, roleId);
    }, 60000);

    afterAll(async () => {
      if (schoolId) await cleanupTestSchool(serviceClient, schoolId);
    }, 60000);

    it("ignores an expired ALLOW exception and keeps the role result", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      await addException(serviceClient, profileId, "qa.exception.expiry", true, adminProfileId, {
        expiresAt: yesterday.toISOString(),
      });

      const accessToken = await signIn(email, password);
      const userClient = createUserClient(accessToken);
      const { data, error } = await userClient.rpc("has_permission", { permission_code: "qa.exception.expiry" });
      expect(error).toBeNull();
      expect(data).toBe(true);
    }, 30000);

    it("ignores an expired DENY exception and keeps the role result", async () => {
      await removeException(serviceClient, profileId, "qa.exception.expiry");
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      await addException(serviceClient, profileId, "qa.exception.expiry", false, adminProfileId, {
        expiresAt: yesterday.toISOString(),
      });

      const accessToken = await signIn(email, password);
      const userClient = createUserClient(accessToken);
      const { data, error } = await userClient.rpc("has_permission", { permission_code: "qa.exception.expiry" });
      expect(error).toBeNull();
      expect(data).toBe(true);
    }, 30000);
  });

  describe("Audit of exception changes", () => {
    let schoolId: string;
    let profileId: string;
    let adminProfileId: string;

    beforeAll(async () => {
      ({ schoolId } = await createTestSchool(serviceClient));
      const admin = await createSingleProfile(serviceClient, schoolId, "exception-audit-admin");
      adminProfileId = admin.profileId;
      const user = await createSingleProfile(serviceClient, schoolId, "exception-audit-user");
      profileId = user.profileId;

      await ensurePermission(serviceClient, "qa.exception.audit", "Permission de test audit exception");
    }, 60000);

    afterAll(async () => {
      if (schoolId) await cleanupTestSchool(serviceClient, schoolId);
    }, 60000);

    it("logs user.exception.added on INSERT", async () => {
      await addException(serviceClient, profileId, "qa.exception.audit", true, adminProfileId, {
        reason: "Audit INSERT test",
      });

      const { data, error } = await serviceClient
        .from("audit_events")
        .select("event_type, payload")
        .eq("school_id", schoolId)
        .eq("event_type", "user.exception.added")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data?.event_type).toBe("user.exception.added");
      expect(data?.payload?.permission_code).toBe("qa.exception.audit");
      expect(data?.payload?.allowed).toBe(true);
      expect(data?.payload?.profile_id).toBe(profileId);
    }, 30000);

    it("logs role.permission.revoked on UPDATE to DENY", async () => {
      const { error: updateError } = await serviceClient
        .from("profile_permission_exceptions")
        .update({ allowed: false, reason: "Audit UPDATE test" })
        .eq("profile_id", profileId)
        .eq("permission_code", "qa.exception.audit");
      expect(updateError).toBeNull();

      const { data, error } = await serviceClient
        .from("audit_events")
        .select("event_type, payload")
        .eq("school_id", schoolId)
        .eq("event_type", "role.permission.revoked")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data?.event_type).toBe("role.permission.revoked");
      expect(data?.payload?.permission_code).toBe("qa.exception.audit");
      expect(data?.payload?.allowed).toBe(false);
      expect(data?.payload?.previous_allowed).toBe(true);
    }, 30000);

    it("logs user.exception.removed on DELETE", async () => {
      await removeException(serviceClient, profileId, "qa.exception.audit");

      const { data, error } = await serviceClient
        .from("audit_events")
        .select("event_type, payload")
        .eq("school_id", schoolId)
        .eq("event_type", "user.exception.removed")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data?.event_type).toBe("user.exception.removed");
      expect(data?.payload?.permission_code).toBe("qa.exception.audit");
      expect(data?.payload?.profile_id).toBe(profileId);
    }, 30000);
  });
});
