export type SetupService = {
  getConfig(): { supabase_url: string; supabase_anon_key: string };
  validateToken(token: string): boolean;
};

export function createSetupService(
  supabaseUrl: string,
  supabaseAnonKey: string,
  setupToken: string | undefined,
): SetupService {
  return {
    getConfig() {
      return { supabase_url: supabaseUrl, supabase_anon_key: supabaseAnonKey };
    },
    validateToken(token: string) {
      if (!setupToken) return false;
      return token === setupToken;
    },
  };
}
