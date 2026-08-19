import type { SupabaseClient } from "@supabase/supabase-js";

export const BASE_SCOPES: Record<string, Array<{ type: string; id?: string }>> = {
  admin_principal: [{ type: "school" }],
  chef_etablissement: [{ type: "school" }],
  enseignant: [{ type: "assigned_classes" }, { type: "assigned_subjects" }],
  agent_controle_acces: [{ type: "assigned_portal" }],
  parent: [{ type: "own_children" }],
};

export async function assignScopes(
  client: SupabaseClient,
  profileId: string,
  scopes: Array<{ type: string; id?: string }>,
): Promise<void> {
  if (scopes.length === 0) return;
  const { error } = await client.from("scope_assignments").insert(
    scopes.map((s) => ({ profile_id: profileId, scope_type: s.type, scope_id: s.id ?? null })),
  );
  if (error) throw new Error(`Scope assignment failed: ${error.message}`);
}
