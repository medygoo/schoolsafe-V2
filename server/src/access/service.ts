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
        throw new Error(`Permission check failed: ${error.message}`);
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
        throw new Error(`Scope check failed: ${error.message}`);
      }
      return data === true;
    },
  };
}
