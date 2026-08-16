import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AdminSetupResult,
  ConfigResponse,
  SetupAdminPayload,
  SetupResult,
  SetupSchoolPayload,
} from "./schema.js";

const cycleNames: Record<string, string> = {
  nursery: "Maternelle",
  primary: "Primaire",
  secondary: "Secondaire et Humanités",
};

const adminRoleId = "20000000-0000-0000-0000-000000000001";

function createServiceClient(supabaseUrl: string, serviceRoleKey: string): SupabaseClient {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export interface SetupService {
  getConfig(): ConfigResponse;
  validateToken(token: string): boolean;
  createSchool(payload: SetupSchoolPayload): Promise<SetupResult>;
  createAdmin(payload: SetupAdminPayload): Promise<AdminSetupResult>;
  findEmailByPhone(phone: string): Promise<string | null>;
}

export function createSetupService(
  supabaseUrl: string,
  anonKey: string,
  serviceRoleKey: string | undefined,
  setupToken: string | undefined,
): SetupService {
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for setup operations");
  }

  const serviceClient = createServiceClient(supabaseUrl, serviceRoleKey);

  return {
    getConfig(): ConfigResponse {
      return { supabase_url: supabaseUrl, supabase_anon_key: anonKey };
    },

    validateToken(token: string): boolean {
      if (!setupToken) return false;
      return token === setupToken;
    },

    async createSchool(payload: SetupSchoolPayload): Promise<SetupResult> {
      const { identity, cycles, academic_year, contact, brand } = payload;

      const { data: school, error: schoolError } = await serviceClient
        .from("school")
        .insert({
          name: identity.name_fr,
          code: identity.approval_code ?? "PENDING",
          name_en: identity.name_en,
          legal_name: identity.legal_name,
          school_type: identity.school_type,
          approval_code: identity.approval_code,
          primary_color: brand.primary_color,
          accent_color: brand.accent_color,
          document_footer: brand.document_footer,
          logo_path: brand.logo_path,
          setup_completed_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (schoolError || !school) {
        throw new Error(`Failed to create school: ${JSON.stringify(schoolError)}`);
      }

      const schoolId = school.id;

      const { data: academicYear, error: yearError } = await serviceClient
        .from("academic_years")
        .insert({
          school_id: schoolId,
          label: academic_year.label,
          starts_on: academic_year.starts_on,
          ends_on: academic_year.ends_on,
          periods: academic_year.periods,
          is_active: true,
        })
        .select("id")
        .single();

      if (yearError || !academicYear) {
        throw new Error(`Failed to create academic year: ${JSON.stringify(yearError)}`);
      }

      const cycleRows = cycles.map((key) => ({
        school_id: schoolId,
        cycle_key: key,
        cycle_name: cycleNames[key],
        is_active: true,
      }));

      const { error: cyclesError } = await serviceClient.from("school_cycles").insert(cycleRows);
      if (cyclesError) {
        throw new Error(`Failed to create school cycles: ${JSON.stringify(cyclesError)}`);
      }

      const { error: contactError } = await serviceClient.from("school_contacts").insert({
        school_id: schoolId,
        country: contact.country,
        province: contact.province,
        city: contact.city,
        address: contact.address,
        email: contact.email,
        phone: contact.phone,
        website_url: contact.website_url || null,
        website_mode: contact.website_mode,
        public_news: contact.public_news,
        public_gallery: contact.public_gallery,
        public_honors: contact.public_honors,
      });

      if (contactError) {
        throw new Error(`Failed to create school contact: ${JSON.stringify(contactError)}`);
      }

      return { school_id: schoolId, academic_year_id: academicYear.id };
    },

    async createAdmin(payload: SetupAdminPayload): Promise<AdminSetupResult> {
      const { email, password, first_name, last_name, phone } = payload;

      const { data: school, error: schoolError } = await serviceClient
        .from("school")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (schoolError || !school) {
        throw new Error(`No school found for admin creation: ${JSON.stringify(schoolError)}`);
      }

      const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name, last_name },
      });

      if (authError || !authData.user) {
        throw new Error(`Failed to create admin user: ${JSON.stringify(authError)}`);
      }

      const displayName = `${first_name} ${last_name}`;

      const { data: profile, error: profileError } = await serviceClient
        .from("profiles")
        .insert({
          id: authData.user.id,
          auth_user_id: authData.user.id,
          school_id: school.id,
          display_name: displayName,
          first_name,
          last_name,
          phone,
          is_active: true,
        })
        .select("id")
        .single();

      if (profileError || !profile) {
        throw new Error(`Failed to create admin profile: ${JSON.stringify(profileError)}`);
      }

      const { error: roleError } = await serviceClient.from("profile_roles").insert({
        profile_id: profile.id,
        role_id: adminRoleId,
      });

      if (roleError) {
        throw new Error(`Failed to assign admin role: ${JSON.stringify(roleError)}`);
      }

      return { user_id: authData.user.id, profile_id: profile.id };
    },

    async findEmailByPhone(phone: string): Promise<string | null> {
      const { data, error } = await serviceClient
        .from("profiles")
        .select("auth_user_id")
        .eq("phone", phone)
        .maybeSingle();

      if (error || !data) return null;

      const { data: user, error: userError } = await serviceClient.auth.admin.getUserById(
        data.auth_user_id,
      );

      if (userError || !user.user?.email) return null;
      return user.user.email;
    },
  };
}
