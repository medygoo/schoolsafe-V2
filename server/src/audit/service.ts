import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface AuditService {
  insert(event: {
    schoolId: string;
    actorProfileId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
}

function createServiceClient(supabaseUrl: string, serviceRoleKey: string): SupabaseClient {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function createSupabaseAuditService(
  clientOrUrl: SupabaseClient | string,
  serviceRoleKey?: string,
): AuditService {
  const client = typeof clientOrUrl === "string" ? createServiceClient(clientOrUrl, serviceRoleKey!) : clientOrUrl;

  return {
    async insert(event) {
      const { error } = await client.from("audit_events").insert({
        school_id: event.schoolId,
        actor_profile_id: event.actorProfileId,
        event_type: event.eventType,
        payload: event.payload,
      });
      if (error) {
        throw new Error(`Failed to insert audit event ${event.eventType}: ${JSON.stringify(error)}`);
      }
    },
  };
}
