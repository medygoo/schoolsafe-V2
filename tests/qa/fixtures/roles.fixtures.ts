import type { SupabaseClient } from "@supabase/supabase-js";

export const BASE_ROLE_ASSIGNMENTS: Record<string, string[]> = {
  admin_principal: ["admin"],
  chef_etablissement: ["principal"],
  responsable_pedagogique: ["pedagogy_manager"],
  responsable_administratif: ["admissions_manager"],
  secretaire_scolaire: ["secretary"],
  responsable_financier: ["finance_manager"],
  agent_caisse: ["cashier"],
  comptable: ["accountant"],
  responsable_rh: ["hr_manager"],
  enseignant: ["teacher"],
  agent_controle_acces: ["security_guard"],
  infirmier: ["nurse"],
  responsable_cantine: ["canteen_manager"],
  responsable_communication: ["communication_manager"],
  parent: ["parent"],
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  principal: "Chef d'établissement",
  pedagogy_manager: "Responsable pédagogique",
  admissions_manager: "Responsable administratif",
  secretary: "Secrétaire scolaire",
  finance_manager: "Responsable financier",
  cashier: "Agent de caisse",
  accountant: "Comptable",
  hr_manager: "Responsable RH",
  teacher: "Enseignant",
  security_guard: "Agent de contrôle d'accès",
  nurse: "Infirmier",
  canteen_manager: "Responsable cantine",
  communication_manager: "Responsable communication",
  parent: "Parent",
};

async function ensureRolesExist(client: SupabaseClient, codes: string[]): Promise<void> {
  const { data: existing } = await client.from("roles").select("code").in("code", codes);
  const existingCodes = new Set((existing ?? []).map((r) => r.code));
  const missing = codes.filter((code) => !existingCodes.has(code));
  if (missing.length === 0) return;

  const { error } = await client
    .from("roles")
    .insert(missing.map((code) => ({ code, label: ROLE_LABELS[code] ?? code })));
  if (error) throw new Error(`Failed to create missing roles: ${error.message}`);
}

export async function assignBaseRoles(
  client: SupabaseClient,
  profileId: string,
  roleCodes: string[],
): Promise<void> {
  await ensureRolesExist(client, roleCodes);

  for (const code of roleCodes) {
    const { data: role, error: roleError } = await client
      .from("roles")
      .select("id")
      .eq("code", code)
      .single();
    if (roleError || !role) throw new Error(`Role not found: ${code}`);
    const { error } = await client.from("profile_roles").insert({ profile_id: profileId, role_id: role.id });
    if (error) throw new Error(`Role assignment failed for ${code}: ${error.message}`);
  }
}
