import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "../lib/supabase.js";

export type UpdateSchoolSettingsInput = {
  identity?: Partial<{
    name: string;
    name_en?: string;
    legal_name?: string;
    school_type?: string;
    approval_code?: string;
  }>;
  brand?: Partial<{
    primary_color?: string;
    accent_color?: string;
    document_footer?: string;
    logo_path?: string;
  }>;
  contact?: Partial<Record<string, string | null>>;
};

export interface SchoolService {
  getSettings(schoolId: string): Promise<unknown>;
  updateSettings(schoolId: string, input: UpdateSchoolSettingsInput): Promise<unknown>;
  listStaff(schoolId: string): Promise<unknown[]>;
  listAcademicYears(schoolId: string): Promise<unknown[]>;
  activateAcademicYear(schoolId: string, yearId: string): Promise<void>;
  listCycles(schoolId: string): Promise<unknown[]>;
  toggleCycle(schoolId: string, cycleKey: string, isActive: boolean): Promise<void>;
}

export function createSchoolService(supabaseUrl: string, serviceRoleKey: string): SchoolService {
  const client = createServiceClient(supabaseUrl, serviceRoleKey);
  return {
    async getSettings(schoolId) {
      const { data: school, error } = await client
        .from("school")
        .select("name, name_en, legal_name, school_type, approval_code, primary_color, accent_color, document_footer, logo_path")
        .eq("id", schoolId)
        .single();
      if (error || !school) throw new Error(`School not found: ${error?.message}`);
      const { data: contact } = await client
        .from("school_contacts")
        .select("country, province, city, address, email, phone, website_url, website_mode, public_news, public_gallery, public_honors")
        .eq("school_id", schoolId)
        .maybeSingle();
      return {
        identity: {
          name: school.name,
          name_en: school.name_en ?? null,
          legal_name: school.legal_name ?? null,
          school_type: school.school_type ?? null,
          approval_code: school.approval_code ?? null,
        },
        brand: {
          primary_color: school.primary_color ?? null,
          accent_color: school.accent_color ?? null,
          document_footer: school.document_footer ?? null,
          logo_path: school.logo_path ?? null,
        },
        contact: contact ?? {},
      };
    },
    async updateSettings(schoolId, input) {
      if (input.identity) {
        const { error } = await client.from("school").update(input.identity).eq("id", schoolId);
        if (error) throw new Error(`Update identity failed: ${error.message}`);
      }
      if (input.brand) {
        const { error } = await client.from("school").update(input.brand).eq("id", schoolId);
        if (error) throw new Error(`Update brand failed: ${error.message}`);
      }
      if (input.contact) {
        const payload: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(input.contact)) payload[k] = v === "" ? null : v;
        const { error } = await client.from("school_contacts").update(payload).eq("school_id", schoolId);
        if (error) throw new Error(`Update contact failed: ${error.message}`);
      }
      return this.getSettings(schoolId);
    },
    async listStaff(schoolId) {
      const { data, error } = await client
        .from("profiles")
        .select("id, first_name, last_name, display_name, phone, is_active, auth_user_id, school_id")
        .eq("school_id", schoolId)
        .order("display_name");
      if (error) throw new Error(`List staff failed: ${error.message}`);
      return data ?? [];
    },
    async listAcademicYears(schoolId) {
      const { data, error } = await client
        .from("academic_years")
        .select("id, label, starts_on, ends_on, periods, is_active")
        .eq("school_id", schoolId)
        .order("starts_on", { ascending: false });
      if (error) throw new Error(`List academic years failed: ${error.message}`);
      return (data ?? []).map((y) => ({ ...y, starts_on: String(y.starts_on), ends_on: String(y.ends_on) }));
    },
    async activateAcademicYear(schoolId, yearId) {
      const { error, count } = await client
        .from("academic_years")
        .update({ is_active: true }, { count: "exact" })
        .eq("id", yearId)
        .eq("school_id", schoolId);
      if (error) throw new Error(`Activate academic year failed: ${error.message}`);
      if (count === 0) throw new Error("Academic year not found");
      await client.rpc("deactivate_other_academic_years", { p_school_id: schoolId, p_active_year_id: yearId });
    },
    async listCycles(schoolId) {
      const { data, error } = await client
        .from("school_cycles")
        .select("cycle_key, cycle_name, is_active")
        .eq("school_id", schoolId)
        .order("cycle_key");
      if (error) throw new Error(`List cycles failed: ${error.message}`);
      if (data && data.length > 0) return data;
      const defaults = [
        { school_id: schoolId, cycle_key: "nursery", cycle_name: "Maternelle", is_active: true },
        { school_id: schoolId, cycle_key: "primary", cycle_name: "Primaire", is_active: true },
        { school_id: schoolId, cycle_key: "secondary", cycle_name: "Secondaire", is_active: true },
      ];
      const { data: inserted, error: insertError } = await client.from("school_cycles").insert(defaults).select("cycle_key, cycle_name, is_active");
      if (insertError || !inserted) throw new Error(`Seed cycles failed: ${insertError?.message}`);
      return inserted;
    },
    async toggleCycle(schoolId, cycleKey, isActive) {
      const { error } = await client
        .from("school_cycles")
        .update({ is_active: isActive })
        .eq("school_id", schoolId)
        .eq("cycle_key", cycleKey);
      if (error) throw new Error(`Toggle cycle failed: ${error.message}`);
    },
  };
}
