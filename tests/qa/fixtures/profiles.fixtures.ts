import type { SupabaseClient } from "@supabase/supabase-js";

export const REFERENCE_PROFILES = [
  "admin_principal",
  "chef_etablissement",
  "responsable_pedagogique",
  "responsable_administratif",
  "secretaire_scolaire",
  "responsable_financier",
  "agent_caisse",
  "comptable",
  "responsable_rh",
  "enseignant",
  "agent_controle_acces",
  "infirmier",
  "responsable_cantine",
  "responsable_communication",
  "parent",
] as const;

export type ReferenceProfile = (typeof REFERENCE_PROFILES)[number];

export async function createReferenceProfiles(
  client: SupabaseClient,
  schoolId: string,
): Promise<Record<ReferenceProfile, string>> {
  const result = {} as Record<ReferenceProfile, string>;
  for (const code of REFERENCE_PROFILES) {
    const authEmail = `qa-${code}@schoolsafe.test`;
    const { data: authData, error: authError } = await client.auth.admin.createUser({
      email: authEmail,
      password: "TestPassword123!",
      email_confirm: true,
    });
    if (authError || !authData.user) throw new Error(`Auth user creation failed for ${code}: ${authError?.message}`);

    const { data: profileData, error: profileError } = await client
      .from("profiles")
      .insert({ auth_user_id: authData.user.id, school_id: schoolId, display_name: code })
      .select("id")
      .single();
    if (profileError || !profileData) throw new Error(`Profile creation failed for ${code}: ${profileError?.message}`);

    result[code] = profileData.id as string;
  }
  return result;
}
