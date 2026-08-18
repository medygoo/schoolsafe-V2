import type { Context, Next } from "hono";
import { SchoolSafeError } from "../lib/errors.js";
import { createUserClient } from "../lib/supabase.js";

export function extractBearer(c: Context): string {
  const auth = c.req.header("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return "";
  return auth.slice(7);
}

export function authMiddleware() {
  return async (c: Context, next: Next) => {
    const token = extractBearer(c);
    if (!token) throw new SchoolSafeError(401, "AUTH_REQUIRED", "Authentification requise", false);
    c.set("token", token);
    await next();
  };
}

export function schoolContextMiddleware(supabaseUrl: string, supabaseAnonKey: string) {
  return async (c: Context, next: Next) => {
    const token = c.get("token") as string | undefined;
    if (!token) return await next();
    const client = createUserClient(supabaseUrl, supabaseAnonKey, token);
    const { data } = await client.from("profiles").select("school_id").single();
    if (data?.school_id) c.set("schoolId", data.school_id);
    await next();
  };
}
