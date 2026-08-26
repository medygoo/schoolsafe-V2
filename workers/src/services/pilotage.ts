import { createServiceClient } from "../lib/supabase.js";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface PilotageService {
  loadDashboard(schoolId: string): Promise<unknown>;
  listAlerts(
    schoolId: string,
    options: { status?: string; severity?: string; limit: number; offset: number },
  ): Promise<{ data: unknown[]; count: number }>;
  acknowledgeAlert(alertId: string, profileId: string): Promise<unknown>;
  resolveAlert(alertId: string, profileId: string, note?: string): Promise<unknown>;
}

export function createPilotageService(supabaseUrl: string, serviceRoleKey: string): PilotageService {
  const client = createServiceClient(supabaseUrl, serviceRoleKey);
  return {
    async loadDashboard(schoolId) {
      const [{ data: alerts }, { data: activeStudents }, { data: staff }] = await Promise.all([
        client.from("alerts").select("severity, status").eq("school_id", schoolId),
        client.rpc("count_operational_students", { p_school_id: schoolId }),
        client.from("profiles").select("id", { count: "exact" }).eq("school_id", schoolId),
      ]);
      return {
        counts: { students: activeStudents ?? 0, staff: staff?.length ?? 0 },
        open_alerts: (alerts ?? []).filter((a) => a.status === "open" || a.status === "acknowledged"),
      };
    },
    async listAlerts(schoolId, options) {
      let q = client
        .from("alerts")
        .select("*", { count: "exact" })
        .eq("school_id", schoolId)
        .order("detected_at", { ascending: false })
        .range(options.offset, options.offset + options.limit - 1);
      if (options.status) q = q.eq("status", options.status);
      if (options.severity) q = q.eq("severity", options.severity);
      const { data, error, count } = await q;
      if (error) throw new Error(`List alerts failed: ${error.message}`);
      return { data: data ?? [], count: count ?? 0 };
    },
    async acknowledgeAlert(alertId, profileId) {
      const { data, error } = await client
        .from("alerts")
        .update({
          status: "acknowledged",
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: profileId,
        })
        .eq("id", alertId)
        .select("*")
        .single();
      if (error || !data) throw new Error(`Acknowledge failed: ${error?.message}`);
      return data;
    },
    async resolveAlert(alertId, profileId, note) {
      const { data, error } = await client
        .from("alerts")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: profileId,
          resolution_note: note ?? null,
        })
        .eq("id", alertId)
        .select("*")
        .single();
      if (error || !data) throw new Error(`Resolve failed: ${error?.message}`);
      return data;
    },
  };
}
