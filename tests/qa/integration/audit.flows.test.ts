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

async function createStudentWithFee(
  client: SupabaseClient,
  schoolId: string,
): Promise<{ studentId: string; feeStructureId: string; studentFeeId: string }> {
  const { data: academicYear, error: academicYearError } = await client
    .from("academic_years")
    .insert({ school_id: schoolId, label: "2026-2027", starts_on: "2026-09-01", ends_on: "2027-06-30", periods: "Trimestres", is_active: true })
    .select("id")
    .single();
  if (academicYearError || !academicYear) throw new Error(`Academic year creation failed: ${academicYearError?.message}`);

  const { data: classData, error: classError } = await client
    .from("classes")
    .insert({ school_id: schoolId, academic_year_id: academicYear.id, cycle_key: "primary", name: "4e primaire" })
    .select("id")
    .single();
  if (classError || !classData) throw new Error(`Class creation failed: ${classError?.message}`);

  const { data: student, error: studentError } = await client
    .from("students")
    .insert({ school_id: schoolId, class_id: classData.id, matricule: `MAT-${Date.now()}`, first_name: "Test", last_name: "Student" })
    .select("id")
    .single();
  if (studentError || !student) throw new Error(`Student creation failed: ${studentError?.message}`);

  const { data: feeStructure, error: feeStructureError } = await client
    .from("fee_structures")
    .insert({
      school_id: schoolId,
      academic_year_id: academicYear.id,
      cycle_key: "primary",
      label: "Frais scolaires",
      amount: 300,
      currency: "USD",
    })
    .select("id")
    .single();
  if (feeStructureError || !feeStructure) throw new Error(`Fee structure creation failed: ${feeStructureError?.message}`);

  const { data: studentFee, error: studentFeeError } = await client
    .from("student_fees")
    .insert({
      school_id: schoolId,
      student_id: student.id,
      fee_structure_id: feeStructure.id,
      status: "pending",
      amount_expected: 300,
      amount_remaining: 300,
    })
    .select("id")
    .single();
  if (studentFeeError || !studentFee) throw new Error(`Student fee creation failed: ${studentFeeError?.message}`);

  return {
    studentId: student.id as string,
    feeStructureId: feeStructure.id as string,
    studentFeeId: studentFee.id as string,
  };
}

async function ensurePermission(client: SupabaseClient, code: string, description: string): Promise<string> {
  const { data: existing, error: lookupError } = await client.from("permissions").select("id").eq("code", code).single();
  if (lookupError && lookupError.code !== "PGRST116") {
    throw new Error(`Failed to lookup permission ${code}: ${lookupError.message}`);
  }
  if (existing) return existing.id as string;

  const { data, error } = await client.from("permissions").insert({ code, description }).select("id").single();
  if (error || !data) throw new Error(`Failed to create permission ${code}: ${error?.message}`);
  return data.id as string;
}

async function latestAuditEvent(
  client: SupabaseClient,
  schoolId: string,
  eventType: string,
): Promise<{ event_type: string; success: boolean; payload: Record<string, unknown>; target_profile_id: string | null } | null> {
  const { data, error } = await client
    .from("audit_events")
    .select("event_type, success, payload, target_profile_id")
    .eq("school_id", schoolId)
    .eq("event_type", eventType)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data as { event_type: string; success: boolean; payload: Record<string, unknown>; target_profile_id: string | null };
}

describe("Audit flows", () => {
  describe("Payment recording", () => {
    let schoolId: string;
    let adminProfileId: string;
    let studentFeeId: string;

    beforeAll(async () => {
      ({ schoolId } = await createTestSchool(serviceClient));
      const admin = await createSingleProfile(serviceClient, schoolId, "audit-payment-admin");
      adminProfileId = admin.profileId;
      ({ studentFeeId } = await createStudentWithFee(serviceClient, schoolId));
    }, 60000);

    afterAll(async () => {
      if (schoolId) await cleanupTestSchool(serviceClient, schoolId);
    }, 60000);

    it("logs finance.payment.recorded when a payment is inserted", async () => {
      const { error: paymentError } = await serviceClient.from("fee_payments").insert({
        school_id: schoolId,
        student_fee_id: studentFeeId,
        amount: 100,
        currency: "USD",
        received_by: adminProfileId,
        mode: "cash",
        reference: "Paiement test audit",
        status: "valid",
      });
      expect(paymentError).toBeNull();

      const event = await latestAuditEvent(serviceClient, schoolId, "finance.payment.recorded");
      expect(event).not.toBeNull();
      expect(event?.event_type).toBe("finance.payment.recorded");
      expect(event?.success).toBe(true);
      expect(event?.payload.amount).toBe(100);
    }, 30000);
  });

  describe("Permission exception audit", () => {
    let schoolId: string;
    let adminProfileId: string;
    let userProfileId: string;

    beforeAll(async () => {
      ({ schoolId } = await createTestSchool(serviceClient));
      const admin = await createSingleProfile(serviceClient, schoolId, "audit-exception-admin");
      adminProfileId = admin.profileId;
      const user = await createSingleProfile(serviceClient, schoolId, "audit-exception-user");
      userProfileId = user.profileId;
      await ensurePermission(serviceClient, "qa.audit.exception.allow", "Permission de test audit exception ALLOW");
    }, 60000);

    afterAll(async () => {
      if (schoolId) await cleanupTestSchool(serviceClient, schoolId);
    }, 60000);

    it("logs user.exception.added when an ALLOW exception is inserted", async () => {
      const { error } = await serviceClient.from("profile_permission_exceptions").insert({
        profile_id: userProfileId,
        permission_code: "qa.audit.exception.allow",
        allowed: true,
        reason: "Audit flow test exception",
        granted_by: adminProfileId,
      });
      expect(error).toBeNull();

      const event = await latestAuditEvent(serviceClient, schoolId, "user.exception.added");
      expect(event).not.toBeNull();
      expect(event?.event_type).toBe("user.exception.added");
      expect(event?.success).toBe(true);
      expect(event?.payload.permission_code).toBe("qa.audit.exception.allow");
      expect(event?.payload.allowed).toBe(true);
      expect(event?.target_profile_id).toBe(userProfileId);
    }, 30000);
  });

  describe("Failed cancellation attempt", () => {
    let schoolId: string;
    let adminProfileId: string;

    beforeAll(async () => {
      ({ schoolId } = await createTestSchool(serviceClient));
      const admin = await createSingleProfile(serviceClient, schoolId, "audit-failure-admin");
      adminProfileId = admin.profileId;
    }, 60000);

    afterAll(async () => {
      if (schoolId) await cleanupTestSchool(serviceClient, schoolId);
    }, 60000);

    it("logs a failed attempt with success=false and reason=condition_denied", async () => {
      const { error } = await serviceClient.rpc("audit_event", {
        p_event_type: "finance.payment.cancel.denied",
        p_actor_profile_id: adminProfileId,
        p_target_profile_id: null,
        p_payload: { payment_id: "pay-old", reason: "condition_denied" },
        p_request_id: null,
        p_success: false,
      });
      expect(error).toBeNull();

      const event = await latestAuditEvent(serviceClient, schoolId, "finance.payment.cancel.denied");
      expect(event).not.toBeNull();
      expect(event?.event_type).toBe("finance.payment.cancel.denied");
      expect(event?.success).toBe(false);
      expect(event?.payload.reason).toBe("condition_denied");
    }, 30000);
  });
});
