import { buildApp } from "./app.js";
import { resolveProfileId, resolveProfileAndSchool } from "./auth/profile.js";
import { createSupabaseAuthVerifier } from "./auth/supabase.js";
import { createBootstrapService } from "./bootstrap/service.js";
import { createCardService } from "./cards/service.js";
import { parseEnv } from "./config/env.js";
import { createSetupService } from "./setup/service.js";
import { createSecurityService } from "./security/service.js";
import { createAlertService } from "./pilotage/alerts/service.js";
import { createDashboardService } from "./pilotage/dashboard/service.js";
import { createBrevoEmailService, createNoopEmailService } from "./email/service.js";
import { createSupabaseAccessService } from "./access/service.js";

const env = parseEnv(process.env);

const r2Config = env.R2_ENDPOINT && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY
  ? {
      endpoint: env.R2_ENDPOINT,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucket: env.R2_BUCKET_CARDS,
    }
  : undefined;

const controlAppConfig = env.CONTROL_APP_URL && env.CONTROL_APP_INSTANCE_ID && env.CONTROL_APP_HMAC_SECRET
  ? {
      url: env.CONTROL_APP_URL,
      instanceId: env.CONTROL_APP_INSTANCE_ID,
      hmacSecret: env.CONTROL_APP_HMAC_SECRET,
    }
  : undefined;

const accessService = createSupabaseAccessService(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

const cardService = env.SUPABASE_SERVICE_ROLE_KEY
  ? createCardService(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, r2Config, controlAppConfig)
  : undefined;

const securityService = env.SUPABASE_SERVICE_ROLE_KEY
  ? createSecurityService(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, env.CARD_HMAC_SECRET)
  : undefined;

const alertService = env.SUPABASE_SERVICE_ROLE_KEY
  ? createAlertService(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  : undefined;

const dashboardService = env.SUPABASE_SERVICE_ROLE_KEY
  ? createDashboardService(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  : undefined;

const emailService = env.BREVO_API_KEY
  ? createBrevoEmailService({
      apiKey: env.BREVO_API_KEY,
      senderEmail: env.BREVO_SENDER_EMAIL ?? "schoolsafe1@gmail.com",
      senderName: "SchoolSafe",
    })
  : createNoopEmailService();

const app = buildApp({
  bootstrap: {
    authVerifier: createSupabaseAuthVerifier(env.SUPABASE_URL, env.SUPABASE_ANON_KEY),
    service: createBootstrapService(env.SUPABASE_URL, env.SUPABASE_ANON_KEY),
  },
  setup: {
    service: createSetupService(
      env.SUPABASE_URL,
      env.SUPABASE_ANON_KEY,
      env.SUPABASE_SERVICE_ROLE_KEY,
      env.SETUP_TOKEN,
    ),
  },
  cards: cardService
    ? {
        service: cardService,
        resolveProfileId: (token: string) => resolveProfileId(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token),
        access: accessService,
      }
    : undefined,
  security: securityService
    ? {
        service: securityService,
        resolveProfileId: (token: string) => resolveProfileId(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token),
        access: accessService,
      }
    : undefined,
  alerts: alertService
    ? {
        service: alertService,
        resolveProfileAndSchool: (token: string) => resolveProfileAndSchool(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token),
        access: accessService,
      }
    : undefined,
  dashboard: dashboardService
    ? {
        service: dashboardService,
        resolveProfileAndSchool: (token: string) => resolveProfileAndSchool(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token),
        access: accessService,
      }
    : undefined,
  email: {
    service: emailService,
    access: accessService,
  },
  access: accessService,
});

await app.listen({ host: env.HOST, port: env.PORT });
