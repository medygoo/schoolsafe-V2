import { createUserContextClient } from "../auth/supabase.js";

export interface AccessService {
  hasPermission(token: string, permissionCode: string): Promise<boolean>;
  hasScope(token: string, scopeType: string, scopeId?: string | null): Promise<boolean>;
}

export function createSupabaseAccessService(
  supabaseUrl: string,
  anonKey: string,
): AccessService {
  return {
    async hasPermission(token: string, permissionCode: string) {
      const client = createUserContextClient(supabaseUrl, anonKey, token);
      const { data, error } = await client.rpc("has_permission", {
        permission_code: permissionCode,
      });
      if (error) {
        console.error(`[access] has_permission error for ${permissionCode}:`, error.message);
        return false;
      }
      return data === true;
    },

    async hasScope(token: string, scopeType: string, scopeId?: string | null) {
      const client = createUserContextClient(supabaseUrl, anonKey, token);
      const { data, error } = await client.rpc("has_scope", {
        requested_scope_type: scopeType,
        requested_scope_id: scopeId ?? null,
      });
      if (error) {
        console.error(`[access] has_scope error for ${scopeType}:`, error.message);
        return false;
      }
      return data === true;
    },
  };
}
