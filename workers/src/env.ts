import { z } from "zod";

export const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SETUP_TOKEN: z.string().min(1).optional(),
  BREVO_API_KEY: z.string().min(1).optional(),
  BREVO_SENDER_EMAIL: z.string().email().optional(),
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).default("mailto:schoolsafe@example.com"),
  CARD_HMAC_SECRET: z.string().min(1).optional(),
  CONTROL_APP_URL: z.string().url().optional(),
  CONTROL_APP_INSTANCE_ID: z.string().min(1).optional(),
  CONTROL_APP_HMAC_SECRET: z.string().min(1).optional(),
  ALLOWED_ORIGINS: z.string().min(1),
});

export type AppEnv = z.infer<typeof envSchema> & {
  SCHOOLSAFE_CACHE: KVNamespace;
  SCHOOLSAFE_FILES: R2Bucket;
  SCHOOLSAFE_ARCHIVE: D1Database;
  SCHOOLSAFE_QUEUE: Queue;
};

export function parseEnv(input: Record<string, unknown>): AppEnv {
  return envSchema.parse(input) as AppEnv;
}
