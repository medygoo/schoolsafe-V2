import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  HOST: z.string().min(1).default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SETUP_TOKEN: z.string().min(1).optional(),
  R2_ENDPOINT: z.string().url().optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET_CARDS: z.string().min(1).default("cards"),
  CONTROL_APP_URL: z.string().url().optional(),
  CONTROL_APP_INSTANCE_ID: z.string().min(1).optional(),
  CONTROL_APP_HMAC_SECRET: z.string().min(1).optional(),
  CARD_HMAC_SECRET: z.string().min(1).optional(),
  ZOHO_MAIL_API_KEY: z.string().min(1).optional(),
  ZOHO_MAIL_SENDER_EMAIL: z.string().email().optional(),
  ZOHO_MAIL_SENDER_NAME: z.string().min(1).default("SchoolSafe"),
  ZOHO_MAIL_REGION: z.enum(["com", "eu", "in", "com.cn", "com.au"]).default("com"),
  BREVO_API_KEY: z.string().min(1).optional(),
  BREVO_SENDER_EMAIL: z.string().email().optional(),
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).default("mailto:schoolsafe@example.com"),
  DEFAULT_STAFF_PASSWORD: z.string().min(8).default("SchoolSafe2026!"),
});

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(input: NodeJS.ProcessEnv): AppEnv {
  return envSchema.parse(input);
}
