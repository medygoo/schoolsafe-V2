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

function createUserClient(accessToken: string): SupabaseClient {
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
): Promise<{ profileId: string; authUserId: string; email: string; password: string }> {
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

  return { profileId: profileData.id as string, authUserId: authData.user.id, email, password };
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

async function assignScope(
  client: SupabaseClient,
  profileId: string,
  scopeType: string,
  scopeId: string | null,
): Promise<void> {
  const { error } = await client
    .from("scope_assignments")
    .insert({ profile_id: profileId, scope_type: scopeType, scope_id: scopeId });
  if (error) throw new Error(`Failed to assign scope: ${error.message}`);
}

describe("RLS chain review C6", () => {
  describe("parent cannot read grades of a non-attached child", () => {
    let schoolId: string;
    let parentEmail: string;
    let parentPassword: string;
    let classId: string;
    let assignmentId: string;
    let ownChildId: string;
    let otherChildId: string;

    beforeAll(async () => {
      ({ schoolId } = await createTestSchool(serviceClient));

      const admin = await createSingleProfile(serviceClient, schoolId, "grade-admin");
      const parent = await createSingleProfile(serviceClient, schoolId, "grade-parent");
      parentEmail = parent.email;
      parentPassword = parent.password;

      const { data: yearData } = await serviceClient
        .from("academic_years")
        .insert({ school_id: schoolId, label: "2025-2026", starts_on: "2025-09-01", ends_on: "2026-06-30", periods: "Trimestres" })
        .select("id")
        .single();
      if (!yearData) throw new Error("Failed to create academic year");
      const yearId = yearData.id as string;

      classId = crypto.randomUUID();
      await serviceClient
        .from("classes")
        .insert({ id: classId, school_id: schoolId, academic_year_id: yearId, cycle_key: "primary", name: "QA Grade Class" });

      const { data: subjectData } = await serviceClient
        .from("subjects")
        .insert({ school_id: schoolId, academic_year_id: yearId, cycle_key: "primary", code: "MATH", name: "Mathématiques", language: "FR" })
        .select("id")
        .single();
      if (!subjectData) throw new Error("Failed to create subject");
      const subjectId = subjectData.id as string;

      const { data: assignmentData } = await serviceClient
        .from("assignments")
        .insert({
          school_id: schoolId,
          academic_year_id: yearId,
          class_id: classId,
          subject_id: subjectId,
          teacher_id: admin.profileId,
          title: "Devoir QA",
          type: "homework",
          language: "FR",
          status: "published",
        })
        .select("id")
        .single();
      if (!assignmentData) throw new Error("Failed to create assignment");
      assignmentId = assignmentData.id as string;

      ownChildId = crypto.randomUUID();
      otherChildId = crypto.randomUUID();
      await serviceClient.from("students").insert([
        { id: ownChildId, school_id: schoolId, class_id: classId, matricule: "QA-OWN-001", first_name: "Enfant", last_name: "Parent" },
        { id: otherChildId, school_id: schoolId, class_id: classId, matricule: "QA-OTH-001", first_name: "Autre", last_name: "Enfant" },
      ]);

      await serviceClient.from("grades").insert([
        { school_id: schoolId, assignment_id: assignmentId, student_id: ownChildId, value_numeric: 12, status: "published", created_by: admin.profileId },
        { school_id: schoolId, assignment_id: assignmentId, student_id: otherChildId, value_numeric: 14, status: "published", created_by: admin.profileId },
      ]);

      const permissionId = await ensurePermission(serviceClient, "pedagogy.grade.read", "Lire les notes");
      const parentRoleId = await ensureRole(serviceClient, "qa_c6_parent", "QA C6 Parent");
      await grantPermission(serviceClient, parentRoleId, permissionId, true);
      await assignRole(serviceClient, parent.profileId, parentRoleId);
      await assignScope(serviceClient, parent.profileId, "own_children", ownChildId);
    }, 60000);

    afterAll(async () => {
      if (schoolId) await cleanupTestSchool(serviceClient, schoolId);
    }, 60000);

    it("returns only the attached child's grade", async () => {
      const accessToken = await signIn(parentEmail, parentPassword);
      const userClient = createUserClient(accessToken);

      const { data: ownData, error: ownError } = await userClient
        .from("grades")
        .select("id, student_id")
        .eq("student_id", ownChildId);
      expect(ownError).toBeNull();
      expect(ownData).toHaveLength(1);

      const { data: otherData, error: otherError } = await userClient
        .from("grades")
        .select("id, student_id")
        .eq("student_id", otherChildId);
      expect(otherError).toBeNull();
      expect(otherData).toHaveLength(0);
    }, 30000);
  });

  describe("cashier can record a payment when cash register is open", () => {
    let schoolId: string;
    let cashierEmail: string;
    let cashierPassword: string;
    let cashierProfileId: string;
    let studentFeeId: string;

    beforeAll(async () => {
      ({ schoolId } = await createTestSchool(serviceClient));

      const cashier = await createSingleProfile(serviceClient, schoolId, "c6-cashier");
      cashierEmail = cashier.email;
      cashierPassword = cashier.password;
      cashierProfileId = cashier.profileId;

      const { data: yearData } = await serviceClient
        .from("academic_years")
        .insert({ school_id: schoolId, label: "2025-2026", starts_on: "2025-09-01", ends_on: "2026-06-30", periods: "Trimestres" })
        .select("id")
        .single();
      if (!yearData) throw new Error("Failed to create academic year");
      const yearId = yearData.id as string;

      const classId = crypto.randomUUID();
      await serviceClient
        .from("classes")
        .insert({ id: classId, school_id: schoolId, academic_year_id: yearId, cycle_key: "primary", name: "QA Cashier Class" });

      const studentId = crypto.randomUUID();
      await serviceClient
        .from("students")
        .insert({ id: studentId, school_id: schoolId, class_id: classId, matricule: "QA-CASH-001", first_name: "Charlie", last_name: "Test" });

      const { data: feeData } = await serviceClient
        .from("fee_structures")
        .insert({ school_id: schoolId, academic_year_id: yearId, cycle_key: "primary", label: "Frais annuels", amount: 100, currency: "USD" })
        .select("id")
        .single();
      if (!feeData) throw new Error("Failed to create fee structure");
      const feeStructureId = feeData.id as string;

      const { data: studentFeeData } = await serviceClient
        .from("student_fees")
        .insert({
          id: crypto.randomUUID(),
          school_id: schoolId,
          student_id: studentId,
          fee_structure_id: feeStructureId,
          status: "pending",
          amount_expected: 100,
          amount_remaining: 100,
        })
        .select("id")
        .single();
      if (!studentFeeData) throw new Error("Failed to create student fee");
      studentFeeId = studentFeeData.id as string;

      await serviceClient
        .from("cash_registers")
        .insert({ school_id: schoolId, date: new Date().toISOString().slice(0, 10), status: "open", opened_by: cashier.profileId });

      const permissionId = await ensurePermission(serviceClient, "finance.payment.record", "Enregistrer un paiement");
      const cashierRoleId = await ensureRole(serviceClient, "qa_c6_cashier", "QA C6 Cashier");
      await grantPermission(serviceClient, cashierRoleId, permissionId, true);
      await assignRole(serviceClient, cashier.profileId, cashierRoleId);
    }, 60000);

    afterAll(async () => {
      if (schoolId) await cleanupTestSchool(serviceClient, schoolId);
    }, 60000);

    it("inserts a payment while the cash register is open", async () => {
      const accessToken = await signIn(cashierEmail, cashierPassword);
      const userClient = createUserClient(accessToken);

      const { data, error } = await userClient
        .from("fee_payments")
        .insert({
          school_id: schoolId,
          student_fee_id: studentFeeId,
          amount: 50,
          currency: "USD",
          received_by: cashierProfileId,
          receipt_no: "R-C6-001",
          status: "valid",
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      expect(data).toBeDefined();
    }, 30000);
  });

  describe("security guard can insert a security event with security.scan", () => {
    let schoolId: string;
    let guardEmail: string;
    let guardPassword: string;
    let guardProfileId: string;
    let studentId: string;
    let cardId: string;
    let locationId: string;

    beforeAll(async () => {
      ({ schoolId } = await createTestSchool(serviceClient));

      const guard = await createSingleProfile(serviceClient, schoolId, "c6-guard");
      guardEmail = guard.email;
      guardPassword = guard.password;
      guardProfileId = guard.profileId;

      const classId = crypto.randomUUID();
      await serviceClient
        .from("classes")
        .insert({ id: classId, school_id: schoolId, cycle_key: "primary", name: "QA Security Class" });

      studentId = crypto.randomUUID();
      await serviceClient
        .from("students")
        .insert({ id: studentId, school_id: schoolId, class_id: classId, matricule: "QA-SEC-001", first_name: "David", last_name: "Test" });

      const { data: locationData } = await serviceClient
        .from("locations")
        .insert({ school_id: schoolId, code: "GATE-C6", label: "Portail C6", kind: "gate" })
        .select("id")
        .single();
      if (!locationData) throw new Error("Failed to create location");
      locationId = locationData.id as string;

      const { data: cardData } = await serviceClient
        .from("student_cards")
        .insert({ school_id: schoolId, student_id: studentId, card_number: "CARD-C6-001", card_secret: "secret", signature: "sig" })
        .select("id")
        .single();
      if (!cardData) throw new Error("Failed to create student card");
      cardId = cardData.id as string;

      const permissionId = await ensurePermission(serviceClient, "security.scan", "Scanner un QR");
      const guardRoleId = await ensureRole(serviceClient, "qa_c6_guard", "QA C6 Guard");
      await grantPermission(serviceClient, guardRoleId, permissionId, true);
      await assignRole(serviceClient, guard.profileId, guardRoleId);
    }, 60000);

    afterAll(async () => {
      if (schoolId) await cleanupTestSchool(serviceClient, schoolId);
    }, 60000);

    it("inserts a security scan event", async () => {
      const accessToken = await signIn(guardEmail, guardPassword);
      const userClient = createUserClient(accessToken);

      const { data, error } = await userClient
        .from("security_events")
        .insert({
          school_id: schoolId,
          student_id: studentId,
          card_id: cardId,
          location_id: locationId,
          event_type: "entry",
          scanned_by: guardProfileId,
          decision: "allowed",
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      expect(data).toBeDefined();
    }, 30000);
  });

  describe("admin can update school_settings with school.manage", () => {
    let schoolId: string;
    let adminEmail: string;
    let adminPassword: string;

    beforeAll(async () => {
      ({ schoolId } = await createTestSchool(serviceClient));

      const admin = await createSingleProfile(serviceClient, schoolId, "c6-admin");
      adminEmail = admin.email;
      adminPassword = admin.password;

      await serviceClient
        .from("school_settings")
        .insert({ school_id: schoolId, max_offline_hours: 24 });

      const permissionId = await ensurePermission(serviceClient, "school.manage", "Gérer l'école");
      const adminRoleId = await ensureRole(serviceClient, "qa_c6_admin", "QA C6 Admin");
      await grantPermission(serviceClient, adminRoleId, permissionId, true);
      await assignRole(serviceClient, admin.profileId, adminRoleId);
    }, 60000);

    afterAll(async () => {
      if (schoolId) await cleanupTestSchool(serviceClient, schoolId);
    }, 60000);

    it("updates max_offline_hours", async () => {
      const accessToken = await signIn(adminEmail, adminPassword);
      const userClient = createUserClient(accessToken);

      const { data, error } = await userClient
        .from("school_settings")
        .update({ max_offline_hours: 48 })
        .eq("school_id", schoolId)
        .select("max_offline_hours")
        .single();
      expect(error).toBeNull();
      expect(data?.max_offline_hours).toBe(48);
    }, 30000);
  });
});
