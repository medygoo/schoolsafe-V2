import { createUserContextClient } from "./supabase.js";

export async function resolveProfileId(
  supabaseUrl: string,
  anonKey: string,
  token: string
): Promise<string | null> {
  const client = createUserContextClient(supabaseUrl, anonKey, token);
  const { data, error } = await client
    .from("profiles")
    .select("id")
    .maybeSingle();
  if (error || !data) return null;
  return data.id as string;
}
