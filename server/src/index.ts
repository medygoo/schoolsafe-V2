import { buildApp } from "./app.js";
import { resolveProfileId, resolveProfileAndSchool } from "./auth/profile.js";
import { createSupabaseAuthVerifier, createUserContextClient } from "./auth/supabase.js";
import { createBootstrapService } from "./bootstrap/service.js";
import { createCardService } from "./cards/service.js";
import { parseEnv } from "./config/env.js";
import { createSetupService } from "./setup/service.js";
import { createSecurityService } from "./security/service.js";
import { createAlertService } from "./pilotage/alerts/service.js";
import { createApprovalService } from "./pilotage/approvals/service.js";
import { createDashboardService } from "./pilotage/dashboard/service.js";
import { createSnapshotService } from "./pilotage/snapshots/service.js";
import { createBrevoEmailService, createNoopEmailService } from "./email/service.js";
import { createFeeControlService } from "./finance/control/service.js";
import { createFinancePaymentService } from "./finance/payments/service.js";
import { createFinanceReportsService } from "./finance/reports/service.js";
import { createPedagogyService } from "./pedagogy/service.js";
import { createRankingsService } from "./pedagogy/rankings/service.js";
import { createSchoolService } from "./school/service.js";
import { createSupabaseAccessService } from "./access/service.js";
import { createStudentsNativeService } from "./studentsnative/service.js";
import { createSupabaseAuditService } from "./audit/service.js";
import { createClient } from "@supabase/supabase-js";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { createEventService } from "./events/service.js";
import { createNotificationService } from "./notifications/service.js";
import { createNotificationDispatcher } from "./notifications/dispatcher.js";
import { createBrevoEmailProvider } from "./notifications/providers/brevo.js";
import { createZohoEmailProvider } from "./notifications/providers/zoho.js";
import { createInAppProvider } from "./notifications/providers/in-app.js";
import { createWebPushProvider } from "./notifications/providers/push.js";
import { createPushSubscriptionService } from "./push/subscriptions.js";
import { registerPushRoutes } from "./push/routes.js";
import { createStudentsService } from "./students/service.js";
import { startVerifiedPools } from "./db/startpools.js";
import { createPgAuthDatabase } from "./db/auth-adapter.js";
import { createAuthNativeService } from "./authnative/service.js";

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

const serviceClient = env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : undefined;

let notificationService: ReturnType<typeof createNotificationService> | undefined;
let dispatcher: ReturnType<typeof createNotificationDispatcher> | undefined;
let pushSubscriptionService: ReturnType<typeof createPushSubscriptionService> | undefined;

if (serviceClient) {
  pushSubscriptionService = createPushSubscriptionService(serviceClient);
  const brevoProvider = env.BREVO_API_KEY
    ? createBrevoEmailProvider({ apiKey: env.BREVO_API_KEY, senderEmail: env.BREVO_SENDER_EMAIL ?? "schoolsafe1@gmail.com" })
    : undefined;
  const zohoProvider = env.ZOHO_MAIL_API_KEY
    ? createZohoEmailProvider(
        {
          apiKey: env.ZOHO_MAIL_API_KEY,
          senderEmail: env.ZOHO_MAIL_SENDER_EMAIL ?? "schoolsafe@example.com",
          senderName: env.ZOHO_MAIL_SENDER_NAME,
          region: env.ZOHO_MAIL_REGION,
        },
        brevoProvider,
      )
    : brevoProvider;
  const pushProvider = env.VAPID_PRIVATE_KEY && env.VAPID_PUBLIC_KEY
    ? createWebPushProvider({
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
        subject: env.VAPID_SUBJECT,
        getSubscriptions: (userId) => pushSubscriptionService!.getSubscriptions(userId),
      })
    : undefined;

  notificationService = createNotificationService(serviceClient, {
    EMAIL: zohoProvider,
    IN_APP: createInAppProvider(),
    PUSH: pushProvider,
  });

  dispatcher = createNotificationDispatcher(serviceClient, notificationService);
}

const eventService = serviceClient
  ? createEventService(serviceClient, dispatcher ? { dispatcher } : undefined)
  : undefined;

// Pools PostgreSQL vérifiés AVANT toute mise en service : si l'auth native est
// configurée mais que les rôles réels ne correspondent pas (ou que la config
// est partielle), startVerifiedPools lève et le serveur ne démarre jamais.
const verifiedPools = await startVerifiedPools(env);
const authNativeService = verifiedPools
  ? createAuthNativeService(createPgAuthDatabase(verifiedPools.authPool))
  : undefined;

const cardService = env.SUPABASE_SERVICE_ROLE_KEY
  ? createCardService(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, r2Config, controlAppConfig)
  : undefined;

const securityService = env.SUPABASE_SERVICE_ROLE_KEY
  ? createSecurityService(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, env.CARD_HMAC_SECRET, eventService)
  : undefined;

const alertService = env.SUPABASE_SERVICE_ROLE_KEY
  ? createAlertService(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  : undefined;

const approvalService = env.SUPABASE_SERVICE_ROLE_KEY
  ? createApprovalService(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  : undefined;

const dashboardService = env.SUPABASE_SERVICE_ROLE_KEY
  ? createDashboardService(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  : undefined;

const snapshotService = env.SUPABASE_SERVICE_ROLE_KEY
  ? createSnapshotService(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  : undefined;

const emailService = env.BREVO_API_KEY
  ? createBrevoEmailService({
      apiKey: env.BREVO_API_KEY,
      senderEmail: env.BREVO_SENDER_EMAIL ?? "schoolsafe1@gmail.com",
      senderName: "SchoolSafe",
    })
  : createNoopEmailService();

const feeControlService = env.SUPABASE_SERVICE_ROLE_KEY
  ? createFeeControlService(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  : undefined;

const auditService = env.SUPABASE_SERVICE_ROLE_KEY
  ? createSupabaseAuditService(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  : undefined;

const financePaymentService = env.SUPABASE_SERVICE_ROLE_KEY
  ? createFinancePaymentService(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  : undefined;

const financeReportsService = env.SUPABASE_SERVICE_ROLE_KEY
  ? createFinanceReportsService(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  : undefined;

const pedagogyService = env.SUPABASE_SERVICE_ROLE_KEY
  ? createPedagogyService(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  : undefined;

const rankingsService = env.SUPABASE_SERVICE_ROLE_KEY
  ? createRankingsService(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  : undefined;

const schoolService = env.SUPABASE_SERVICE_ROLE_KEY
  ? createSchoolService(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      env.DEFAULT_STAFF_PASSWORD ?? "SchoolSafe2026!",
      notificationService,
    )
  : undefined;

const studentsService = serviceClient
  ? createStudentsService(
      serviceClient,
      (token: string) => createUserContextClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token),
      {
        async deliver(invitation) {
          const activationUrl = `http://${env.HOST}:${env.PORT}/#parent-invitation=${encodeURIComponent(invitation.token)}`;
          const result = await emailService.send({
            to: [{ email: invitation.email, name: invitation.firstName }],
            subject: "Activez votre compte Parent SchoolSafe",
            text: [
              `Bonjour ${invitation.firstName},`,
              "Un dossier élève vous rattache comme Parent principal dans SchoolSafe.",
              `Activez personnellement votre compte avant le ${invitation.expiresAt} : ${activationUrl}`,
              "L’école ne connaît et ne définit jamais votre mot de passe.",
            ].join("\n\n"),
          });
          if (result.status === "failed") {
            throw new Error(result.error || "Échec de l’envoi de l’invitation Parent");
          }
        },
      },
    )
  : undefined;

const app = buildApp({
  authNative: authNativeService
    ? {
        service: authNativeService,
        cookieSecure: env.NODE_ENV === "production",
      }
    : undefined,
  studentsNative: verifiedPools && authNativeService
    ? {
        authService: authNativeService,
        service: createStudentsNativeService(verifiedPools.businessPool),
      }
    : undefined,
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
      `http://${env.HOST}:${env.PORT}`,
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
        resolveProfileAndSchool: (token: string) => resolveProfileAndSchool(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token),
        access: accessService,
        eventService,
        audit: auditService,
      }
    : undefined,
  alerts: alertService
    ? {
        service: alertService,
        resolveProfileAndSchool: (token: string) => resolveProfileAndSchool(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token),
        access: accessService,
      }
    : undefined,
  approvals: approvalService
    ? {
        service: approvalService,
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
  snapshots: snapshotService
    ? {
        service: snapshotService,
        resolveProfileAndSchool: (token: string) => resolveProfileAndSchool(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token),
        access: accessService,
      }
    : undefined,
  email: {
    service: emailService,
    access: accessService,
  },
  feeControl: feeControlService
    ? {
        service: feeControlService,
        resolveProfileAndSchool: (token: string) => resolveProfileAndSchool(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token),
        access: accessService,
      }
    : undefined,
  financePayments: financePaymentService
    ? {
        service: financePaymentService,
        resolveProfileAndSchool: (token: string) => resolveProfileAndSchool(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token),
        access: accessService,
        audit: auditService,
      }
    : undefined,
  financeReports: financeReportsService
    ? {
        service: financeReportsService,
        resolveProfileAndSchool: (token: string) => resolveProfileAndSchool(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token),
        access: accessService,
        audit: auditService,
      }
    : undefined,
  pedagogy: pedagogyService && rankingsService
    ? {
        service: pedagogyService,
        rankingsService,
        resolveProfileAndSchool: (token: string) => resolveProfileAndSchool(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token),
        access: accessService,
        audit: auditService,
      }
    : undefined,
  school: schoolService
    ? {
        service: schoolService,
        resolveProfileAndSchool: (token: string) => resolveProfileAndSchool(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token),
        access: accessService,
      }
    : undefined,
  students: studentsService
    ? {
        service: studentsService,
        access: accessService,
        resolveProfileAndSchool: (token: string) =>
          resolveProfileAndSchool(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token),
      }
    : undefined,
  push: pushSubscriptionService
    ? {
        subscriptionService: pushSubscriptionService,
        resolveProfileId: (token: string) => resolveProfileId(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, token),
        access: accessService,
        vapidPublicKey: env.VAPID_PUBLIC_KEY,
      }
    : undefined,
  access: accessService,
});

await app.register(fastifyStatic, {
  root: path.resolve(process.cwd(), "server/uploads"),
  prefix: "/uploads/",
});

await app.register(fastifyStatic, {
  root: path.resolve(import.meta.dirname, "..", "..", "app"),
  prefix: "/",
  wildcard: true,
  decorateReply: false,
});

await app.listen({ host: env.HOST, port: env.PORT });
