import type { SupabaseClient } from "@supabase/supabase-js";

export async function createTestSchool(client: SupabaseClient): Promise<{ schoolId: string }> {
  const { data, error } = await client
    .from("school")
    .insert({ code: `test-qa-${Date.now()}`, name: "École QA" })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to create school: ${error?.message}`);
  return { schoolId: data.id as string };
}
