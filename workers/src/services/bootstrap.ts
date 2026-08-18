import { createUserClient, createServiceClient } from "../lib/supabase.js";

export type BootstrapService = {
  load(accessToken: string): Promise<unknown>;
};

export function createBootstrapService(
  supabaseUrl: string,
  supabaseAnonKey: string,
  serviceRoleKey: string,
): BootstrapService {
  return {
    async load(accessToken: string) {
      const userClient = createUserClient(supabaseUrl, supabaseAnonKey, accessToken);
      const { data: userData, error: userError } = await userClient.auth.getUser();
      if (userError || !userData.user) return null;

      const serviceClient = createServiceClient(supabaseUrl, serviceRoleKey);
      const { data: profile, error: profileError } = await serviceClient
        .from("profiles")
        .select("*")
        .eq("auth_user_id", userData.user.id)
        .single();
      if (profileError || !profile) return null;

      // Phase 1 returns profile only; roles, permissions, scopes and school are loaded in Phase 2 Task 2.1.
      return { profile };
    },
  };
}
