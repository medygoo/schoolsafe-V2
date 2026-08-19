import type { SupabaseClient } from "@supabase/supabase-js";

export async function cleanupTestSchool(client: SupabaseClient, schoolId: string): Promise<void> {
  // Audit events reference the school with ON DELETE RESTRICT, so remove them first.
  const { error: auditError } = await client.from("audit_events").delete().eq("school_id", schoolId);
  if (auditError) throw new Error(`Failed to delete audit events: ${auditError.message}`);

  // Profiles reference the school with ON DELETE RESTRICT and auth.users with ON DELETE CASCADE.
  // Deleting auth users cascades to profiles, devices, profile_roles and scope_assignments.
  const { data: profiles } = await client.from("profiles").select("auth_user_id").eq("school_id", schoolId);
  const userIds = (profiles ?? []).map((p) => p.auth_user_id).filter(Boolean);
  for (const userId of userIds) {
    const { error: authError } = await client.auth.admin.deleteUser(userId);
    if (authError) throw new Error(`Failed to delete auth user ${userId}: ${authError.message}`);
  }

  // Remaining school-owned data is removed by cascading deletes.
  const { error } = await client.from("school").delete().eq("id", schoolId);
  if (error) throw new Error(`Failed to delete school: ${error.message}`);
}
