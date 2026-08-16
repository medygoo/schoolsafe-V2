import { createUserContextClient } from "../auth/supabase.js";
import type { BootstrapResponse } from "./schema.js";

export interface BootstrapService {
  load(accessToken: string): Promise<BootstrapResponse | null>;
}

type QueryResult<T> = { data: T | null; error: unknown };

function assertQuery<T>(result: QueryResult<T>, label: string): T | null {
  if (result.error) {
    throw new Error(`Bootstrap query failed: ${label}`);
  }
  return result.data;
}

export function createBootstrapService(
  supabaseUrl: string,
  anonKey: string,
): BootstrapService {
  return {
    async load(accessToken: string) {
      const client = createUserContextClient(supabaseUrl, anonKey, accessToken);

      const profile = assertQuery(
        await client
          .from("profiles")
          .select("id,display_name,school_id")
          .maybeSingle(),
        "profile",
      ) as { id: string; display_name: string; school_id: string } | null;

      if (!profile) return null;

      const profileRoles = (assertQuery(
        await client.from("profile_roles").select("role_id"),
        "profile_roles",
      ) ?? []) as Array<{ role_id: string }>;
      const roleIds = profileRoles.map((row) => row.role_id);

      const roles = roleIds.length
        ? ((assertQuery(
            await client.from("roles").select("id,code").in("id", roleIds),
            "roles",
          ) ?? []) as Array<{ id: string; code: string }> )
        : [];

      const grants = roleIds.length
        ? ((assertQuery(
            await client
              .from("role_permission_grants")
              .select("permission_id")
              .in("role_id", roleIds)
              .eq("allowed", true),
            "role_permission_grants",
          ) ?? []) as Array<{ permission_id: string }> )
        : [];
      const permissionIds = [...new Set(grants.map((row) => row.permission_id))];

      const permissions = permissionIds.length
        ? ((assertQuery(
            await client.from("permissions").select("id,code").in("id", permissionIds),
            "permissions",
          ) ?? []) as Array<{ id: string; code: string }> )
        : [];

      const scopes = (assertQuery(
        await client.from("scope_assignments").select("scope_type,scope_id,label"),
        "scope_assignments",
      ) ?? []) as Array<{ scope_type: string; scope_id: string | null; label: string | null }>;

      const school = assertQuery(
        await client.from("school").select("id,name").eq("id", profile.school_id).maybeSingle(),
        "school",
      ) as { id: string; name: string } | null;
      if (!school) return null;

      const settings = assertQuery(
        await client
          .from("school_settings")
          .select("max_offline_hours")
          .eq("school_id", profile.school_id)
          .maybeSingle(),
        "school_settings",
      ) as { max_offline_hours: number } | null;

      return {
        contract_version: "1",
        profile: { id: profile.id, display_name: profile.display_name },
        roles: roles.map((row) => row.code).sort(),
        permissions: permissions.map((row) => row.code).sort(),
        scopes: scopes.map((row) => ({ type: row.scope_type, id: row.scope_id, label: row.label })),
        school: { id: school.id, name: school.name },
        academic_year: null,
        features: [],
        offline_policy: { max_offline_hours: settings?.max_offline_hours ?? 24 },
      };
    },
  };
}
