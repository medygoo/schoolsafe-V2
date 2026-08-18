import { createUserClient } from "../lib/supabase.js";

export interface AccessService {
  hasPermission(token: string, permissionCode: string): Promise<boolean>;
  hasScope(token: string, scopeType: string, scopeId?: string | null): Promise<boolean>;
}

export function createAccessService(supabaseUrl: string, supabaseAnonKey: string): AccessService {
  return {
    async hasPermission(token, permissionCode) {
      const client = createUserClient(supabaseUrl, supabaseAnonKey, token);
      const { data, error } = await client.rpc("has_permission", { permission_code: permissionCode });
      if (error) throw new Error(`Permission check failed: ${error.message}`);
      return data === true;
    },
    async hasScope(token, scopeType, scopeId) {
      const client = createUserClient(supabaseUrl, supabaseAnonKey, token);
      const { data, error } = await client.rpc("has_scope", {
        requested_scope_type: scopeType,
        requested_scope_id: scopeId ?? null,
      });
      if (error) throw new Error(`Scope check failed: ${error.message}`);
      return data === true;
    },
  };
}
