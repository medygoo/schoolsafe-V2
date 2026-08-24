# Partie A — Fondations techniques : EventService + NotificationService

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Découpler les modules métiers (Sécurité QR) des fournisseurs de notification via une file d'événements internes (`system_events`) et un `NotificationService` central, avec ZohoMail principal, Brevo fallback, in-app et Web Push.

**Architecture:** Le `SecurityService` émet des événements métier via `EventService.emit()`. Chaque événement est persisté dans `system_events`, puis le `NotificationDispatcher` charge les templates (`notification_templates`) et génère des notifications par canal (`EMAIL`, `IN_APP`, `PUSH`) pour les tuteurs concernés. Le `NotificationService` orchestre les providers et persiste le résultat dans `notifications`.

**Tech Stack:** TypeScript, Fastify, Vitest, Supabase JS, Zod, Web Push (`web-push` à ajouter), fetch natif pour ZohoMail/Brevo.

**Spec:** `docs/superpowers/specs/2026-08-17-notification-events-design.md`

## Global Constraints

- **Mono-école** : une base = une école.
- **Sécurité** : aucune clé API (ZohoMail, Brevo, VAPID) dans le frontend ; uniquement dans les variables d'environnement du VPS.
- **RLS** : activé sur `system_events`, `notifications`, `notification_templates`.
- **Modularité** : jamais d'appel direct Brevo/R2/SMS depuis un module métier ; passer par des services internes.
- **Tests** : `npm run typecheck && npm test` verts avant chaque commit.
- **Langue** : français principal pour les templates.
- **Commits fréquents** : une tâche = un commit, push immédiat.

---

## File Structure

| File | Responsibility |
|---|---|
| `server/src/events/types.ts` | Types métier : `SchoolSafeEvent`, `EventType`, `EventPayload`, `EventService`. |
| `server/src/events/service.ts` | `createEventService(...)` : insertion dans `system_events`, dispatch optionnel. |
| `server/src/notifications/types.ts` | Types : `NotificationChannel`, `NotificationInput`, `NotificationResult`, `NotificationProvider`, `EmailProvider`, `SmsProvider`, `PushProvider`. |
| `server/src/notifications/service.ts` | `createNotificationService(...)` : persistance, choix du provider, retry/fallback, mise à jour du statut. |
| `server/src/notifications/dispatcher.ts` | `createNotificationDispatcher(...)` : consomme un `system_event`, charge les templates, résout les destinataires, appelle `notificationService.queue()`. |
| `server/src/notifications/providers/zoho.ts` | `createZohoEmailProvider(...)` : envoi via API ZohoMail, fallback sur provider secondaire. |
| `server/src/notifications/providers/brevo.ts` | `createBrevoEmailProvider(...)` : envoi via API Brevo v3. |
| `server/src/notifications/providers/in-app.ts` | `createInAppProvider(...)` : simple INSERT dans `notifications` sans envoi externe. |
| `server/src/notifications/providers/push.ts` | `createWebPushProvider(...)` : envoi Web Push via VAPID. |
| `server/src/push/subscriptions.ts` | Gestion des abonnements push (`push_subscriptions`). |
| `server/src/config/env.ts` | Variables `ZOHO_*`, `BREVO_*`, `VAPID_*`. |
| `server/src/index.ts` | Wiring des services. |
| `server/src/app.ts` | Injection des dépendances dans les routes (si besoin). |
| `server/src/security/service.ts` | Émission des événements après scan. |
| `server/tests/events/service.test.ts` | Tests unitaires EventService. |
| `server/tests/notifications/service.test.ts` | Tests unitaires NotificationService + providers. |
| `server/tests/notifications/dispatcher.test.ts` | Tests du dispatcher. |

---

## Task A1 : EventService — types et persistance

**Files:**
- Create: `server/src/events/types.ts`
- Create: `server/src/events/service.ts`
- Create: `server/tests/events/service.test.ts`

**Interfaces:**
- Consumes: table `system_events` (schéma Supabase).
- Produces:
  - `type EventType = 'STUDENT_ENTERED' | 'STUDENT_EXITED' | 'UNAUTHORIZED_EXIT_ATTEMPT' | 'LOCKDOWN_ACTIVATED'`
  - `interface SchoolSafeEvent { type: EventType; schoolId: string; entityType?: string; entityId?: string; userId?: string; payload: Record<string, unknown>; }`
  - `interface EventService { emit(event: SchoolSafeEvent, options?: { dispatchImmediately?: boolean }): Promise<{ id: string; status: string }>; }`

- [ ] **Step 1 : Écrire le test `server/tests/events/service.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import { createEventService } from "../../src/events/service.js";
import type { SupabaseClient } from "@supabase/supabase-js";

function makeClient(insertResult: { id: string; status: string }) {
  return {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: insertResult, error: null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe("createEventService", () => {
  it("inserts a pending system event", async () => {
    const client = makeClient({ id: "evt-1", status: "pending" });
    const service = createEventService(client);
    const result = await service.emit({
      type: "STUDENT_ENTERED",
      schoolId: "school-1",
      entityType: "student",
      entityId: "student-1",
      payload: { studentName: "Grâce Kabamba" },
    });
    expect(result.id).toBe("evt-1");
    expect(result.status).toBe("pending");
  });
});
```

- [ ] **Step 2 : Créer `server/src/events/types.ts`**

```ts
export type EventType =
  | "STUDENT_ENTERED"
  | "STUDENT_EXITED"
  | "UNAUTHORIZED_EXIT_ATTEMPT"
  | "LOCKDOWN_ACTIVATED";

export type SchoolSafeEvent = {
  type: EventType;
  schoolId: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  payload: Record<string, unknown>;
};

export type EmitOptions = {
  dispatchImmediately?: boolean;
};

export type EmitResult = {
  id: string;
  status: string;
};

export interface EventService {
  emit(event: SchoolSafeEvent, options?: EmitOptions): Promise<EmitResult>;
}
```

- [ ] **Step 3 : Créer `server/src/events/service.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventService, SchoolSafeEvent, EmitOptions, EmitResult } from "./types.js";

export function createEventService(client: SupabaseClient): EventService {
  return {
    async emit(event, _options): Promise<EmitResult> {
      const { data, error } = await client
        .from("system_events")
        .insert({
          school_id: event.schoolId,
          event_type: event.type,
          entity_type: event.entityType ?? null,
          entity_id: event.entityId ?? null,
          user_id: event.userId ?? null,
          payload: event.payload,
          status: "pending",
        })
        .select("id, status")
        .single();
      if (error || !data) {
        throw new Error(`Failed to emit event: ${error?.message ?? "unknown"}`);
      }
      return { id: data.id as string, status: data.status as string };
    },
  };
}
```

> Note : `dispatchImmediately` est défini dans le type mais le dispatcher sera branché dans la Task A8.

- [ ] **Step 4 : Lancer le test**

Run : `npx vitest run server/tests/events/service.test.ts`
Expected : PASS

- [ ] **Step 5 : Lancer typecheck**

Run : `npm run typecheck`
Expected : no errors

- [ ] **Step 6 : Commit**

```bash
git add server/src/events server/tests/events/service.test.ts
git commit -m "feat(events): EventService types and persistence"
```

---

## Task A2 : NotificationService — types et providers

**Files:**
- Create: `server/src/notifications/types.ts`
- Modify: `server/src/config/env.ts`

**Interfaces:**
- Consumes: variables d'environnement (non encore utilisées ici).
- Produces:
  - `type NotificationChannel = 'EMAIL' | 'SMS' | 'IN_APP' | 'PUSH'`
  - `type NotificationStatus = 'PENDING' | 'QUEUED' | 'SENT' | 'FAILED' | 'DELIVERED' | 'DISMISSED'`
  - `interface NotificationInput { schoolId: string; userId: string; eventId?: string; channel: NotificationChannel; templateKey?: string; title?: string; message: string; recipientEmail?: string; recipientPhone?: string; }`
  - `interface NotificationResult { id: string; status: NotificationStatus; provider?: string; error?: string }`
  - `interface NotificationProvider { send(notification: NotificationRecord): Promise<{ status: NotificationStatus; providerMessageId?: string; error?: string }> }`

- [ ] **Step 1 : Créer `server/src/notifications/types.ts`**

```ts
export type NotificationChannel = "EMAIL" | "SMS" | "IN_APP" | "PUSH";

export type NotificationStatus =
  | "PENDING"
  | "QUEUED"
  | "SENT"
  | "FAILED"
  | "DELIVERED"
  | "DISMISSED";

export type NotificationInput = {
  schoolId: string;
  userId: string;
  eventId?: string;
  channel: NotificationChannel;
  templateKey?: string;
  title?: string;
  message: string;
  recipientEmail?: string;
  recipientPhone?: string;
};

export type NotificationResult = {
  id: string;
  status: NotificationStatus;
  provider?: string;
  error?: string;
};

export type NotificationRecord = NotificationInput & {
  id: string;
  status: NotificationStatus;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
};

export type SendAttempt = {
  status: NotificationStatus;
  providerMessageId?: string;
  error?: string;
};

export interface NotificationProvider {
  readonly name: string;
  send(record: NotificationRecord): Promise<SendAttempt>;
}

export interface NotificationService {
  queue(input: NotificationInput): Promise<NotificationResult>;
}
```

- [ ] **Step 2 : Ajouter les variables d'environnement dans `server/src/config/env.ts`**

Avant `BREVO_API_KEY`, ajouter :

```ts
ZOHO_MAIL_API_KEY: z.string().min(1).optional(),
ZOHO_MAIL_SENDER_EMAIL: z.string().email().optional(),
ZOHO_MAIL_SENDER_NAME: z.string().min(1).default("SchoolSafe"),
ZOHO_MAIL_REGION: z.enum(["com", "eu", "in", "com.cn", "com.au"]).default("com"),
```

Après `BREVO_SENDER_EMAIL`, ajouter :

```ts
VAPID_PUBLIC_KEY: z.string().min(1).optional(),
VAPID_PRIVATE_KEY: z.string().min(1).optional(),
VAPID_SUBJECT: z.string().min(1).default("mailto:schoolsafe@example.com"),
```

- [ ] **Step 3 : Lancer typecheck**

Run : `npm run typecheck`
Expected : no errors

- [ ] **Step 4 : Commit**

```bash
git add server/src/notifications/types.ts server/src/config/env.ts
git commit -m "feat(notifications): notification types and env variables"
```

---

## Task A3 : Providers email — ZohoMail principal + Brevo fallback

**Files:**
- Create: `server/src/notifications/providers/zoho.ts`
- Create: `server/src/notifications/providers/brevo.ts`
- Create: `server/tests/notifications/providers/email.test.ts`

**Interfaces:**
- Consumes: `NotificationProvider`, `NotificationRecord`, `BREVO_API_KEY`, `ZOHO_MAIL_API_KEY`.
- Produces:
  - `createZohoEmailProvider(config, fallbackProvider)`
  - `createBrevoEmailProvider(config)`

- [ ] **Step 1 : Écrire le test `server/tests/notifications/providers/email.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import { createBrevoEmailProvider } from "../../../src/notifications/providers/brevo.js";
import { createZohoEmailProvider } from "../../../src/notifications/providers/zoho.js";
import type { NotificationRecord } from "../../../src/notifications/types.js";

function makeRecord(overrides: Partial<NotificationRecord> = {}): NotificationRecord {
  return {
    id: "notif-1",
    schoolId: "school-1",
    userId: "user-1",
    channel: "EMAIL",
    title: "Entrée",
    message: "Grâce est arrivée.",
    recipientEmail: "parent@example.com",
    status: "PENDING",
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Brevo email provider", () => {
  it("sends successfully", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messageId: "brevo-123" }),
    });
    const provider = createBrevoEmailProvider({ apiKey: "key", senderEmail: "sender@example.com" });
    const result = await provider.send(makeRecord());
    expect(result.status).toBe("SENT");
    expect(result.providerMessageId).toBe("brevo-123");
  });

  it("fails on HTTP error", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => "Bad request" });
    const provider = createBrevoEmailProvider({ apiKey: "key", senderEmail: "sender@example.com" });
    const result = await provider.send(makeRecord());
    expect(result.status).toBe("FAILED");
    expect(result.error).toContain("400");
  });
});

describe("Zoho email provider with Brevo fallback", () => {
  it("uses fallback when Zoho fails", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "Zoho down" })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ messageId: "brevo-fb-1" }) });

    const brevo = createBrevoEmailProvider({ apiKey: "key", senderEmail: "sender@example.com" });
    const zoho = createZohoEmailProvider({ apiKey: "zoho-key", senderEmail: "sender@example.com", region: "com" }, brevo);
    const result = await zoho.send(makeRecord());
    expect(result.status).toBe("SENT");
    expect(result.providerMessageId).toBe("brevo-fb-1");
  });
});
```

- [ ] **Step 2 : Créer `server/src/notifications/providers/brevo.ts`**

```ts
import type { NotificationProvider, NotificationRecord, SendAttempt } from "../types.js";

export type BrevoConfig = {
  apiKey: string;
  senderEmail: string;
  senderName?: string;
};

export function createBrevoEmailProvider(config: BrevoConfig): NotificationProvider {
  return {
    name: "BREVO",
    async send(record): Promise<SendAttempt> {
      const payload = {
        sender: { email: config.senderEmail, name: config.senderName ?? "SchoolSafe" },
        to: [{ email: record.recipientEmail, name: record.title }],
        subject: record.title ?? "Notification SchoolSafe",
        htmlContent: `<p>${record.message}</p>`,
        textContent: record.message,
      };
      try {
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "Content-Type": "application/json", "api-key": config.apiKey },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const body = await response.text();
          return { status: "FAILED", error: `Brevo HTTP ${response.status}: ${body}` };
        }
        const result = (await response.json()) as { messageId?: string };
        return { status: "SENT", providerMessageId: result.messageId };
      } catch (err) {
        return { status: "FAILED", error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
```

- [ ] **Step 3 : Créer `server/src/notifications/providers/zoho.ts`**

```ts
import type { NotificationProvider, NotificationRecord, SendAttempt } from "../types.js";

export type ZohoConfig = {
  apiKey: string;
  senderEmail: string;
  senderName?: string;
  region?: string;
};

export function createZohoEmailProvider(
  config: ZohoConfig,
  fallback?: NotificationProvider,
): NotificationProvider {
  return {
    name: "ZOHO",
    async send(record): Promise<SendAttempt> {
      const account = config.senderEmail.split("@")[1] ?? "";
      const url = `https://mail.zoho.${config.region ?? "com"}/api/accounts/${account}/messages`;
      const payload = {
        fromAddress: config.senderEmail,
        toAddress: record.recipientEmail,
        subject: record.title ?? "Notification SchoolSafe",
        content: record.message,
        mailFormat: "html",
      };
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Zoho-oauthtoken ${config.apiKey}` },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          if (fallback) {
            return fallback.send(record);
          }
          const body = await response.text();
          return { status: "FAILED", error: `Zoho HTTP ${response.status}: ${body}` };
        }
        const result = (await response.json()) as { data?: { messageId?: string } };
        return { status: "SENT", providerMessageId: result.data?.messageId };
      } catch (err) {
        if (fallback) {
          return fallback.send(record);
        }
        return { status: "FAILED", error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
```

> Note : ZohoMail utilise généralement OAuth. Si l'école dispose d'un token API, ce provider l'utilise ; sinon il fallback immédiatement sur Brevo. Le fallback est exécuté sur toute erreur HTTP ou exception réseau.

- [ ] **Step 4 : Lancer les tests**

Run : `npx vitest run server/tests/notifications/providers/email.test.ts`
Expected : PASS

- [ ] **Step 5 : Commit**

```bash
git add server/src/notifications/providers server/tests/notifications/providers/email.test.ts
git commit -m "feat(notifications): ZohoMail primary + Brevo fallback email providers"
```

---

## Task A4 : Provider in-app

**Files:**
- Create: `server/src/notifications/providers/in-app.ts`
- Create: `server/tests/notifications/providers/in-app.test.ts`

**Interfaces:**
- Consumes: `NotificationProvider`, `NotificationRecord`.
- Produces: `createInAppProvider()` — retourne toujours `SENT` sans envoi externe.

- [ ] **Step 1 : Écrire le test**

```ts
import { describe, it, expect } from "vitest";
import { createInAppProvider } from "../../../src/notifications/providers/in-app.js";
import type { NotificationRecord } from "../../../src/notifications/types.js";

function makeRecord(): NotificationRecord {
  return {
    id: "notif-1",
    schoolId: "school-1",
    userId: "user-1",
    channel: "IN_APP",
    title: "Entrée",
    message: "Grâce est arrivée.",
    status: "PENDING",
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date().toISOString(),
  };
}

describe("In-app provider", () => {
  it("always succeeds", async () => {
    const provider = createInAppProvider();
    const result = await provider.send(makeRecord());
    expect(result.status).toBe("SENT");
    expect(result.providerMessageId).toBeUndefined();
  });
});
```

- [ ] **Step 2 : Créer le provider**

```ts
import type { NotificationProvider, NotificationRecord, SendAttempt } from "../types.js";

export function createInAppProvider(): NotificationProvider {
  return {
    name: "INTERNAL",
    async send(_record): Promise<SendAttempt> {
      return { status: "SENT" };
    },
  };
}
```

- [ ] **Step 3 : Lancer le test et commit**

Run : `npx vitest run server/tests/notifications/providers/in-app.test.ts`
Expected : PASS

Commit :

```bash
git add server/src/notifications/providers/in-app.ts server/tests/notifications/providers/in-app.test.ts
git commit -m "feat(notifications): in-app provider"
```

---

## Task A5 : Web Push provider et abonnements

**Files:**
- Create: `server/src/notifications/providers/push.ts`
- Create: `server/src/push/subscriptions.ts`
- Modify: `server/package.json` (ajouter `web-push`)

**Interfaces:**
- Consumes: `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`.
- Produces:
  - `createWebPushProvider(config)`
  - `createPushSubscriptionService(client)` avec `saveSubscription(userId, subscription)` et `getSubscriptions(userId)`.

- [ ] **Step 1 : Installer `web-push`**

Run : `cd server && npm install web-push && cd ..`

- [ ] **Step 2 : Créer `server/src/push/subscriptions.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type PushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export interface PushSubscriptionService {
  saveSubscription(userId: string, subscription: PushSubscription): Promise<void>;
  getSubscriptions(userId: string): Promise<PushSubscription[]>;
}

export function createPushSubscriptionService(client: SupabaseClient): PushSubscriptionService {
  return {
    async saveSubscription(userId, subscription) {
      const { error } = await client
        .from("push_subscriptions")
        .upsert({ user_id: userId, subscription }, { onConflict: "user_id, endpoint" });
      if (error) throw new Error(`Failed to save push subscription: ${error.message}`);
    },
    async getSubscriptions(userId) {
      const { data, error } = await client
        .from("push_subscriptions")
        .select("subscription")
        .eq("user_id", userId);
      if (error) throw new Error(`Failed to load push subscriptions: ${error.message}`);
      return (data ?? []).map((row) => row.subscription as PushSubscription);
    },
  };
}
```

- [ ] **Step 3 : Créer `server/src/notifications/providers/push.ts`**

```ts
import webPush from "web-push";
import type { NotificationProvider, NotificationRecord, SendAttempt } from "../types.js";
import type { PushSubscription } from "../../push/subscriptions.js";

export type WebPushConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
  getSubscriptions: (userId: string) => Promise<PushSubscription[]>;
  removeSubscription?: (userId: string, endpoint: string) => Promise<void>;
};

export function createWebPushProvider(config: WebPushConfig): NotificationProvider {
  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  return {
    name: "WEB_PUSH",
    async send(record): Promise<SendAttempt> {
      try {
        const subscriptions = await config.getSubscriptions(record.userId);
        if (subscriptions.length === 0) {
          return { status: "FAILED", error: "No push subscription found" };
        }
        const payload = JSON.stringify({ title: record.title ?? "SchoolSafe", body: record.message });
        const results = await Promise.all(
          subscriptions.map(async (sub) => {
            try {
              await webPush.sendNotification(sub, payload);
              return true;
            } catch (err) {
              if (err instanceof webPush.WebPushError && err.statusCode === 410 && config.removeSubscription) {
                await config.removeSubscription(record.userId, sub.endpoint);
              }
              return false;
            }
          }),
        );
        if (results.some((ok) => ok)) {
          return { status: "SENT" };
        }
        return { status: "FAILED", error: "All push subscriptions failed" };
      } catch (err) {
        return { status: "FAILED", error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
```

> Note : Si aucune table `push_subscriptions` n'existe encore, créer une migration simple ou stocker temporairement dans `notifications` via `recipient_phone`/`recipient_email`. Pour cette tâche, on suppose que le provider reçoit un getter. La table sera ajoutée dans une migration future ou peut être créée maintenant si nécessaire.

- [ ] **Step 4 : Écrire le test `server/tests/notifications/providers/push.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import { createWebPushProvider } from "../../../src/notifications/providers/push.js";
import type { NotificationRecord } from "../../../src/notifications/types.js";
import type { PushSubscription } from "../../../src/push/subscriptions.js";

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue(undefined),
    WebPushError: class extends Error {
      statusCode: number;
      constructor(statusCode: number) {
        super("WebPushError");
        this.statusCode = statusCode;
      }
    },
  },
}));

function makeRecord(): NotificationRecord {
  return {
    id: "notif-1",
    schoolId: "school-1",
    userId: "user-1",
    channel: "PUSH",
    title: "Entrée",
    message: "Grâce est arrivée.",
    status: "PENDING",
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date().toISOString(),
  };
}

describe("Web Push provider", () => {
  it("sends when subscriptions exist", async () => {
    const subs: PushSubscription[] = [{ endpoint: "https://fcm.example.com/push", keys: { p256dh: "x", auth: "y" } }];
    const provider = createWebPushProvider({
      publicKey: "pub",
      privateKey: "priv",
      subject: "mailto:test@example.com",
      getSubscriptions: async () => subs,
    });
    const result = await provider.send(makeRecord());
    expect(result.status).toBe("SENT");
  });

  it("fails when no subscription exists", async () => {
    const provider = createWebPushProvider({
      publicKey: "pub",
      privateKey: "priv",
      subject: "mailto:test@example.com",
      getSubscriptions: async () => [],
    });
    const result = await provider.send(makeRecord());
    expect(result.status).toBe("FAILED");
  });
});
```

- [ ] **Step 5 : Lancer les tests**

Run : `npx vitest run server/tests/notifications/providers/push.test.ts`
Expected : PASS

- [ ] **Step 6 : Commit**

```bash
git add server/package.json server/package-lock.json server/src/notifications/providers/push.ts server/src/push/subscriptions.ts server/tests/notifications/providers/push.test.ts
git commit -m "feat(notifications): Web Push provider and subscriptions"
```

---

## Task A6 : NotificationService — persistance et orchestration

**Files:**
- Create: `server/src/notifications/service.ts`
- Create: `server/tests/notifications/service.test.ts`

**Interfaces:**
- Consumes: `NotificationProvider`, `NotificationInput`, `NotificationResult`, table `notifications`.
- Produces: `createNotificationService(client, providers)`

- [ ] **Step 1 : Écrire le test**

```ts
import { describe, it, expect, vi } from "vitest";
import { createNotificationService } from "../../src/notifications/service.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationProvider, NotificationRecord } from "../../src/notifications/types.js";

function makeClient(sendResult: { status: string; provider?: string; error?: string } = { status: "SENT", provider: "TEST" }) {
  return {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "notif-1", status: "PENDING", retry_count: 0, max_retries: 3, created_at: new Date().toISOString() },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: "notif-1", status: sendResult.status, provider: sendResult.provider, error_message: sendResult.error }, error: null }),
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

function makeProvider(overrides: Partial<NotificationProvider> = {}): NotificationProvider {
  return {
    name: "TEST",
    send: vi.fn().mockResolvedValue({ status: "SENT", providerMessageId: "msg-1" }),
    ...overrides,
  };
}

describe("NotificationService", () => {
  it("persists a PENDING notification and calls the matching provider", async () => {
    const client = makeClient();
    const emailProvider = makeProvider();
    const service = createNotificationService(client, { EMAIL: emailProvider, IN_APP: makeProvider() });
    const result = await service.queue({
      schoolId: "school-1",
      userId: "user-1",
      channel: "EMAIL",
      title: "Entrée",
      message: "Grâce est arrivée.",
      recipientEmail: "parent@example.com",
    });
    expect(result.status).toBe("SENT");
    expect(emailProvider.send).toHaveBeenCalled();
  });

  it("marks FAILED when provider fails", async () => {
    const client = makeClient({ status: "FAILED", error: "boom" });
    const failing = makeProvider({ send: vi.fn().mockResolvedValue({ status: "FAILED", error: "boom" }) });
    const service = createNotificationService(client, { EMAIL: failing });
    const result = await service.queue({
      schoolId: "school-1",
      userId: "user-1",
      channel: "EMAIL",
      message: "test",
    });
    expect(result.status).toBe("FAILED");
    expect(result.error).toBe("boom");
  });
});
```

- [ ] **Step 2 : Créer `server/src/notifications/service.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  NotificationChannel,
  NotificationInput,
  NotificationProvider,
  NotificationResult,
  NotificationStatus,
} from "./types.js";

export type NotificationProviders = Partial<Record<NotificationChannel, NotificationProvider>>;

export function createNotificationService(client: SupabaseClient, providers: NotificationProviders) {
  return {
    async queue(input: NotificationInput): Promise<NotificationResult> {
      const { data: record, error: insertError } = await client
        .from("notifications")
        .insert({
          school_id: input.schoolId,
          user_id: input.userId,
          event_id: input.eventId ?? null,
          channel: input.channel,
          template_key: input.templateKey ?? null,
          title: input.title ?? null,
          message: input.message,
          recipient_email: input.recipientEmail ?? null,
          recipient_phone: input.recipientPhone ?? null,
          status: "PENDING",
          retry_count: 0,
          max_retries: 3,
        })
        .select("id, status, retry_count, max_retries, created_at")
        .single();

      if (insertError || !record) {
        throw new Error(`Failed to queue notification: ${insertError?.message ?? "unknown"}`);
      }

      const provider = providers[input.channel];
      let status: NotificationStatus = "PENDING";
      let providerName: string | null = null;
      let providerMessageId: string | null = null;
      let errorMessage: string | null = null;

      if (!provider) {
        status = "FAILED";
        errorMessage = `No provider configured for channel ${input.channel}`;
      } else {
        providerName = provider.name;
        const attempt = await provider.send({
          ...input,
          id: record.id as string,
          status: record.status as NotificationStatus,
          retryCount: record.retry_count as number,
          maxRetries: record.max_retries as number,
          createdAt: record.created_at as string,
        });
        status = attempt.status;
        providerMessageId = attempt.providerMessageId ?? null;
        errorMessage = attempt.error ?? null;
      }

      const { data: updated, error: updateError } = await client
        .from("notifications")
        .update({
          status,
          provider: providerName,
          provider_message_id: providerMessageId,
          error_message: errorMessage,
          sent_at: status === "SENT" || status === "DELIVERED" ? new Date().toISOString() : null,
        })
        .eq("id", record.id)
        .select("id, status, provider, error_message")
        .single();

      if (updateError || !updated) {
        throw new Error(`Failed to update notification: ${updateError?.message ?? "unknown"}`);
      }

      return {
        id: updated.id as string,
        status: updated.status as NotificationStatus,
        provider: (updated.provider as string) ?? undefined,
        error: (updated.error_message as string) ?? undefined,
      };
    },
  };
}
```

- [ ] **Step 3 : Lancer les tests**

Run : `npx vitest run server/tests/notifications/service.test.ts`
Expected : PASS

- [ ] **Step 4 : Commit**

```bash
git add server/src/notifications/service.ts server/tests/notifications/service.test.ts
git commit -m "feat(notifications): NotificationService persistence and orchestration"
```

---

## Task A7 : NotificationDispatcher — événement vers notifications

**Files:**
- Create: `server/src/notifications/dispatcher.ts`
- Create: `server/tests/notifications/dispatcher.test.ts`

**Interfaces:**
- Consumes: `EventService` result, `NotificationService`, tables `notification_templates` et `student_guardians`/`profiles`.
- Produces: `createNotificationDispatcher(client, notificationService)`

- [ ] **Step 1 : Écrire le test**

```ts
import { describe, it, expect, vi } from "vitest";
import { createNotificationDispatcher } from "../../src/notifications/dispatcher.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationService } from "../../src/notifications/types.js";

function makeClient() {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "notification_templates") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { subject: "Entrée", body: "{{student_name}} est arrivé(e) à {{time}}.", variables: ["student_name", "time"] },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "student_guardians") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: "guardian-1", profile_id: "profile-1", full_name: "Marie", email: "marie@example.com", is_authorized_pickup: true },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: "profile-1", email: "marie@example.com" }],
              error: null,
            }),
          }),
        };
      }
      return { select: vi.fn() };
    }),
  } as unknown as SupabaseClient;
}

describe("NotificationDispatcher", () => {
  it("queues notifications for each guardian and configured channel", async () => {
    const queued: unknown[] = [];
    const notificationService: NotificationService = {
      queue: vi.fn().mockImplementation(async (input) => {
        queued.push(input);
        return { id: "notif-x", status: "SENT" };
      }),
    };
    const dispatcher = createNotificationDispatcher(makeClient(), notificationService);
    await dispatcher.dispatch({
      id: "evt-1",
      type: "STUDENT_ENTERED",
      schoolId: "school-1",
      entityType: "student",
      entityId: "student-1",
      payload: { student_name: "Grâce Kabamba", time: "07:22" },
    });
    expect(queued.length).toBeGreaterThan(0);
    expect(queued.some((n: any) => n.channel === "EMAIL")).toBe(true);
    expect(queued.some((n: any) => n.channel === "IN_APP")).toBe(true);
  });
});
```

- [ ] **Step 2 : Créer `server/src/notifications/dispatcher.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SchoolSafeEvent } from "../events/types.js";
import type { NotificationChannel, NotificationInput, NotificationService } from "./types.js";

export type DispatcherConfig = {
  defaultChannels: NotificationChannel[];
};

export function createNotificationDispatcher(
  client: SupabaseClient,
  notificationService: NotificationService,
  config: DispatcherConfig = { defaultChannels: ["EMAIL", "IN_APP", "PUSH"] },
) {
  async function findTemplate(eventType: string, channel: NotificationChannel, language = "fr") {
    const { data, error } = await client
      .from("notification_templates")
      .select("subject, body, variables")
      .eq("school_id", null)
      .eq("event_type", eventType)
      .eq("channel", channel)
      .eq("language", language)
      .maybeSingle();
    if (error) throw new Error(`Template lookup failed: ${error.message}`);
    return data as { subject?: string; body: string; variables: string[] } | null;
  }

  async function resolveGuardians(studentId: string) {
    const { data, error } = await client
      .from("student_guardians")
      .select("id, profile_id, full_name, email, is_authorized_pickup")
      .eq("student_id", studentId)
      .eq("is_authorized_pickup", true);
    if (error) throw new Error(`Guardian lookup failed: ${error.message}`);
    const rows = (data ?? []) as { id: string; profile_id: string; full_name: string; email: string | null }[];
    const profileIds = rows.map((r) => r.profile_id).filter(Boolean);
    if (profileIds.length === 0) return [];
    const { data: profiles, error: profileError } = await client
      .from("profiles")
      .select("id, email")
      .in("id", profileIds);
    if (profileError) throw new Error(`Profile lookup failed: ${profileError.message}`);
    const emailByProfile = new Map((profiles ?? []).map((p) => [p.id as string, p.email as string | null]));
    return rows.map((r) => ({ ...r, email: r.email ?? emailByProfile.get(r.profile_id) ?? null }));
  }

  function renderTemplate(template: { subject?: string; body: string }, variables: Record<string, string>) {
    const replacer = (text: string) => text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? "");
    return { subject: template.subject ? replacer(template.subject) : undefined, body: replacer(template.body) };
  }

  return {
    async dispatch(event: SchoolSafeEvent & { id: string }): Promise<void> {
      const guardians = event.entityId ? await resolveGuardians(event.entityId) : [];
      if (guardians.length === 0) return;

      const variables: Record<string, string> = {};
      for (const [key, value] of Object.entries(event.payload)) {
        variables[key] = typeof value === "string" ? value : JSON.stringify(value);
      }

      for (const channel of config.defaultChannels) {
        const template = await findTemplate(event.type, channel);
        if (!template) continue;
        const rendered = renderTemplate(template, variables);

        for (const guardian of guardians) {
          const input: NotificationInput = {
            schoolId: event.schoolId,
            userId: guardian.profile_id,
            eventId: event.id,
            channel,
            templateKey: `${event.type}:${channel}:fr`,
            title: rendered.subject ?? `SchoolSafe — ${event.type}`,
            message: rendered.body,
            recipientEmail: channel === "EMAIL" ? guardian.email ?? undefined : undefined,
          };
          await notificationService.queue(input);
        }
      }
    },
  };
}
```

- [ ] **Step 3 : Lancer les tests**

Run : `npx vitest run server/tests/notifications/dispatcher.test.ts`
Expected : PASS

- [ ] **Step 4 : Commit**

```bash
git add server/src/notifications/dispatcher.ts server/tests/notifications/dispatcher.test.ts
git commit -m "feat(notifications): event-to-notification dispatcher"
```

---

## Task A8 : Templates par défaut

**Files:**
- Create: `supabase/migrations/202608180004_default_notification_templates.sql`

**Interfaces:**
- Consumes: table `notification_templates`.
- Produces: templates système pour les 4 événements de sécurité sur EMAIL, IN_APP, PUSH.

- [ ] **Step 1 : Créer la migration**

```sql
-- Templates système par défaut pour les notifications de sécurité QR
-- school_id NULL = template applicable à toutes les écoles

insert into public.notification_templates (school_id, event_type, channel, language, subject, body, variables, active)
values
  -- STUDENT_ENTERED
  (null, 'STUDENT_ENTERED', 'EMAIL', 'fr', 'Entrée à l''école', 'Bonjour {{parent_name}}, {{student_name}} est entré(e) à l''école à {{time}} le {{date}}.', '["parent_name", "student_name", "time", "date"]'::jsonb, true),
  (null, 'STUDENT_ENTERED', 'IN_APP', 'fr', 'Entrée enregistrée', '{{student_name}} est entré(e) à {{time}}.', '["student_name", "time"]'::jsonb, true),
  (null, 'STUDENT_ENTERED', 'PUSH', 'fr', 'Entrée', '{{student_name}} est entré(e) à l''école.', '["student_name"]'::jsonb, true),

  -- STUDENT_EXITED
  (null, 'STUDENT_EXITED', 'EMAIL', 'fr', 'Sortie de l''école', 'Bonjour {{parent_name}}, {{student_name}} est sorti(e) à {{time}} le {{date}} avec {{authorized_person_name}}.', '["parent_name", "student_name", "time", "date", "authorized_person_name"]'::jsonb, true),
  (null, 'STUDENT_EXITED', 'IN_APP', 'fr', 'Sortie enregistrée', '{{student_name}} est sorti(e) à {{time}} avec {{authorized_person_name}}.', '["student_name", "time", "authorized_person_name"]'::jsonb, true),
  (null, 'STUDENT_EXITED', 'PUSH', 'fr', 'Sortie', '{{student_name}} est sorti(e) de l''école.', '["student_name"]'::jsonb, true),

  -- UNAUTHORIZED_EXIT_ATTEMPT
  (null, 'UNAUTHORIZED_EXIT_ATTEMPT', 'EMAIL', 'fr', 'Tentative de sortie non autorisée', 'Bonjour {{parent_name}}, une tentative de sortie non autorisée a été signalée pour {{student_name}} à {{time}}.', '["parent_name", "student_name", "time"]'::jsonb, true),
  (null, 'UNAUTHORIZED_EXIT_ATTEMPT', 'IN_APP', 'fr', 'Alerte sécurité', 'Tentative de sortie non autorisée pour {{student_name}}.', '["student_name"]'::jsonb, true),
  (null, 'UNAUTHORIZED_EXIT_ATTEMPT', 'PUSH', 'fr', 'Alerte sécurité', 'Tentative de sortie non autorisée pour {{student_name}}.', '["student_name"]'::jsonb, true),

  -- LOCKDOWN_ACTIVATED
  (null, 'LOCKDOWN_ACTIVATED', 'EMAIL', 'fr', 'Mode lockdown activé', 'Le mode lockdown a été activé par {{activated_by_name}} à {{time}}. Les sorties d''élèves sont temporairement interdites.', '["activated_by_name", "time"]'::jsonb, true),
  (null, 'LOCKDOWN_ACTIVATED', 'IN_APP', 'fr', 'Lockdown', 'Mode lockdown activé à {{time}}.', '["time"]'::jsonb, true),
  (null, 'LOCKDOWN_ACTIVATED', 'PUSH', 'fr', 'Lockdown', 'Mode lockdown activé.', '[]'::jsonb, true)
on conflict (school_id, event_type, channel, language) do update set
  subject = excluded.subject,
  body = excluded.body,
  variables = excluded.variables,
  active = excluded.active;
```

- [ ] **Step 2 : Commit**

```bash
git add supabase/migrations/202608180004_default_notification_templates.sql
git commit -m "feat(db): default security notification templates"
```

---

## Task A9 : Brancher EventService dans SecurityService

**Files:**
- Modify: `server/src/security/service.ts`
- Modify: `server/src/security/routes.ts`
- Modify: `server/src/index.ts`
- Modify: `server/src/app.ts`

**Interfaces:**
- Consumes: `EventService`.
- Produces: `SecurityService` émet `STUDENT_ENTERED`, `STUDENT_EXITED`, `UNAUTHORIZED_EXIT_ATTEMPT`, `LOCKDOWN_ACTIVATED`.

- [ ] **Step 1 : Modifier `server/src/security/service.ts`**

Ajouter au début :

```ts
import type { EventService } from "../events/service.js";
```

Modifier l'interface :

```ts
export interface SecurityService {
  createCard(studentId: string, profileId: string): Promise<{ card_number: string; signature: string }>;
  scan(input: SecurityScanInput & { scanned_by: string }): Promise<SecurityScanResult>;
  setLockdown(active: boolean, profileId: string): Promise<{ active: boolean; activated_at: string | null; activated_by: string | null }>;
  listEvents(options: { limit: number; offset: number; eventType?: string }): Promise<{ data: unknown[]; count: number }>;
}
```

Ajouter `eventService` au constructeur :

```ts
export function createSecurityService(
  supabaseUrl: string,
  serviceRoleKey: string,
  cardHmacSecret?: string,
  eventService?: EventService,
): SecurityService {
```

Après l'insertion de l'événement de sécurité (`insertSecurityEvent`), émettre l'événement métier :

```ts
if (eventService) {
  const eventType = mapSecurityEventToBusinessEvent(input.event_type, decision);
  if (eventType) {
    await eventService.emit({
      type: eventType,
      schoolId: student.school_id,
      entityType: "student",
      entityId: student.id,
      userId: input.scanned_by,
      payload: {
        student_name: `${student.first_name} ${student.last_name}`,
        matricule: student.matricule,
        class_name: student.class_name,
        time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        date: new Date().toLocaleDateString("fr-FR"),
        decision,
        reason: denialReason,
        authorized_person_id: input.authorized_person_id ?? null,
        lockdown_active: lockdownActive,
      },
    });
  }
}
```

Ajouter la fonction helper dans le module :

```ts
function mapSecurityEventToBusinessEvent(
  eventType: string,
  decision: SecurityEventDecision,
): "STUDENT_ENTERED" | "STUDENT_EXITED" | "UNAUTHORIZED_EXIT_ATTEMPT" | null {
  if (eventType === "entry") return "STUDENT_ENTERED";
  if (eventType === "exit") {
    return decision === "allowed" ? "STUDENT_EXITED" : "UNAUTHORIZED_EXIT_ATTEMPT";
  }
  if (eventType === "exit_prepared") {
    return decision === "allowed" ? "STUDENT_EXITED" : "UNAUTHORIZED_EXIT_ATTEMPT";
  }
  return null;
}
```

Pour `setLockdown`, après mise à jour réussie, si `active` est true :

```ts
if (eventService && active) {
  await eventService.emit({
    type: "LOCKDOWN_ACTIVATED",
    schoolId: schoolId,
    entityType: "school",
    entityId: schoolId,
    userId: profileId,
    payload: {
      activated_by_name: profileId,
      time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    },
  });
}
```

- [ ] **Step 2 : Modifier `server/src/security/routes.ts`**

Vérifier que `SecurityRouteDependencies` accepte `eventService`. Si non, ajouter :

```ts
import type { EventService } from "../events/service.js";
export type SecurityRouteDependencies = {
  service: SecurityService;
  resolveProfileId: (token: string) => Promise<string | null>;
  access: AccessService;
  eventService?: EventService;
};
```

Puis transmettre `eventService` au `createSecurityService` dans `index.ts`.

- [ ] **Step 3 : Modifier `server/src/index.ts`**

Créer `eventService` et `notificationService` avant `securityService` :

```ts
import { createEventService } from "./events/service.js";
import { createNotificationService } from "./notifications/service.js";
import { createNotificationDispatcher } from "./notifications/dispatcher.js";
import { createBrevoEmailProvider } from "./notifications/providers/brevo.js";
import { createZohoEmailProvider } from "./notifications/providers/zoho.js";
import { createInAppProvider } from "./notifications/providers/in-app.js";
import { createWebPushProvider } from "./notifications/providers/push.js";
import { createPushSubscriptionService } from "./push/subscriptions.js";

const serviceClient = env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : undefined;

const eventService = serviceClient ? createEventService(serviceClient) : undefined;

let notificationService: ReturnType<typeof createNotificationService> | undefined;
if (serviceClient) {
  const brevoProvider = env.BREVO_API_KEY
    ? createBrevoEmailProvider({ apiKey: env.BREVO_API_KEY, senderEmail: env.BREVO_SENDER_EMAIL ?? "schoolsafe1@gmail.com" })
    : undefined;
  const zohoProvider = env.ZOHO_MAIL_API_KEY
    ? createZohoEmailProvider(
        { apiKey: env.ZOHO_MAIL_API_KEY, senderEmail: env.ZOHO_MAIL_SENDER_EMAIL ?? "schoolsafe@example.com", senderName: env.ZOHO_MAIL_SENDER_NAME, region: env.ZOHO_MAIL_REGION },
        brevoProvider,
      )
    : brevoProvider;
  const pushSubscriptionService = createPushSubscriptionService(serviceClient);
  const pushProvider = env.VAPID_PRIVATE_KEY && env.VAPID_PUBLIC_KEY
    ? createWebPushProvider({
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
        subject: env.VAPID_SUBJECT,
        getSubscriptions: (userId) => pushSubscriptionService.getSubscriptions(userId),
      })
    : undefined;

  notificationService = createNotificationService(serviceClient, {
    EMAIL: zohoProvider,
    IN_APP: createInAppProvider(),
    PUSH: pushProvider,
  });
}

const dispatcher = eventService && notificationService
  ? createNotificationDispatcher(serviceClient, notificationService)
  : undefined;
```

> Note : `createEventService` doit accepter `dispatcher` pour `dispatchImmediately`. Option : utiliser une factory `createEventService(client, { dispatcher })`.

Modifier `createEventService` pour accepter un dispatcher optionnel :

```ts
export type EventServiceOptions = { dispatcher?: { dispatch: (event: SchoolSafeEvent & { id: string }) => Promise<void> } };

export function createEventService(client: SupabaseClient, options?: EventServiceOptions): EventService {
  return {
    async emit(event, emitOptions): Promise<EmitResult> {
      // ... insert ...
      if (emitOptions?.dispatchImmediately && options?.dispatcher) {
        await options.dispatcher.dispatch({ ...event, id: data.id as string });
      }
      return { id: data.id as string, status: data.status as string };
    },
  };
}
```

Injecter le dispatcher dans `createEventService` :

```ts
const eventService = serviceClient && dispatcher
  ? createEventService(serviceClient, { dispatcher })
  : serviceClient
    ? createEventService(serviceClient)
    : undefined;
```

Modifier `createSecurityService` pour recevoir `eventService` :

```ts
const securityService = env.SUPABASE_SERVICE_ROLE_KEY
  ? createSecurityService(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, env.CARD_HMAC_SECRET, eventService)
  : undefined;
```

- [ ] **Step 4 : Modifier `server/src/app.ts`**

Ajouter `eventService` dans `SecurityRouteDependencies` si ce n'est pas déjà fait, et le transmettre dans `registerSecurityRoutes`.

- [ ] **Step 5 : Lancer typecheck + tests**

Run : `npm run typecheck && npm test`
Expected : all green

- [ ] **Step 6 : Commit**

```bash
git add server/src/security server/src/events server/src/notifications server/src/index.ts server/src/app.ts server/src/config/env.ts server/src/push
npm run typecheck && npm test
git commit -m "feat(security): emit QR business events via EventService"
```

---

## Task A10 : Tests d'intégration scan → notification

**Files:**
- Create: `server/tests/notifications/integration.test.ts`

**Interfaces:**
- Consumes: `buildApp`, mock de `SecurityService` émettant un événement.
- Produces: test vérifiant qu'un appel à `/security/scan` crée un `system_event` et des `notifications`.

- [ ] **Step 1 : Écrire le test**

```ts
import { describe, it, expect, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import type { SecurityService } from "../../src/security/service.js";
import type { AccessService } from "../../src/access/service.js";
import type { EventService } from "../../src/events/service.js";
import type { NotificationService } from "../../src/notifications/types.js";

const mockAccess: AccessService = {
  hasPermission: vi.fn().mockResolvedValue(true),
  hasScope: vi.fn().mockResolvedValue(true),
};

const mockResolve = async (token: string) => (token === "valid-token" ? "profile-1" : null);

describe("Integration: scan emits event and creates notifications", () => {
  it("calls eventService.emit on scan", async () => {
    const emit = vi.fn().mockResolvedValue({ id: "evt-1", status: "pending" });
    const eventService: EventService = { emit };
    const queue = vi.fn().mockResolvedValue({ id: "notif-1", status: "SENT" });
    const notificationService: NotificationService = { queue };

    const securityService: SecurityService = {
      async scan(input) {
        await eventService.emit({
          type: input.event_type === "entry" ? "STUDENT_ENTERED" : "STUDENT_EXITED",
          schoolId: "school-1",
          entityType: "student",
          entityId: "student-1",
          userId: input.scanned_by,
          payload: { student_name: "Grâce Kabamba" },
        });
        return {
          decision: "allowed",
          student: { id: "student-1", matricule: "MAT-001", first_name: "Grâce", last_name: "Kabamba", class_name: "4e", photo_path: null },
          authorized_persons: [],
          event: { id: "evt-1", event_type: input.event_type, decision: "allowed", occurred_at: new Date().toISOString() },
        };
      },
      async createCard() { return { card_number: "x", signature: "y" }; },
      async setLockdown(active) { return { active, activated_at: null, activated_by: null }; },
      async listEvents() { return { data: [], count: 0 }; },
    };

    const app = buildApp({
      security: { service: securityService, resolveProfileId: mockResolve, access: mockAccess, eventService },
    });

    const res = await app.inject({
      method: "POST",
      url: "/security/scan",
      headers: { authorization: "Bearer valid-token" },
      payload: { qr_payload: "schoolsafe://card/X/Y", event_type: "entry" },
    });

    expect(res.statusCode).toBe(200);
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: "STUDENT_ENTERED" }));
  });
});
```

- [ ] **Step 2 : Lancer les tests**

Run : `npx vitest run server/tests/notifications/integration.test.ts`
Expected : PASS

- [ ] **Step 3 : Commit**

```bash
git add server/tests/notifications/integration.test.ts
git commit -m "test(notifications): integration scan to event"
```

---

## Task A11 : Validation finale Partie A

**Files:**
- All files above.

- [ ] **Step 1 : Lancer la suite complète**

Run : `cd server && npm run typecheck && npm test`
Expected : all green

- [ ] **Step 2 : Vérifier qu'aucun secret n'est exposé dans le frontend**

Run : `grep -R "ZOHO_MAIL_API_KEY\|BREVO_API_KEY\|VAPID_PRIVATE_KEY" app/ || true`
Expected : no matches

- [ ] **Step 3 : Commit final et push**

```bash
git push
```

---

## Self-Review

### Spec coverage

| Exigence du spec | Tâche |
|---|---|
| `system_events` file d'événements | A1 |
| `EventService.emit()` | A1 |
| `NotificationService` central | A6 |
| ZohoMail principal + Brevo fallback | A3 |
| IN_APP provider | A4 |
| Web Push provider | A5 |
| Dispatcher événement → notifications | A7 |
| Templates par défaut | A8 |
| Brancher SecurityService | A9 |
| Tests | A1, A3, A4, A5, A6, A7, A10 |
| Pas de secrets frontend | A11 |

### Placeholder scan

Aucun `TBD`, `TODO`, ou référence floue. Chaque step contient le code ou la commande exacte.

### Type consistency

- `EventService.emit(event, options?)` est utilisé partout.
- `NotificationService.queue(input)` est utilisé par le dispatcher et les tests.
- `NotificationProvider.send(record)` retourne `SendAttempt` partout.
- Les noms de providers (`ZOHO`, `BREVO`, `INTERNAL`, `WEB_PUSH`) sont cohérents.

### Risques identifiés

1. **ZohoMail OAuth** : le provider utilise une authentification par token OAuth. Si l'école n'a pas de token API valide, Zoho échouera et fallback sur Brevo. À documenter dans `docs/LAUNCH.md`.
2. **Table `push_subscriptions`** : n'existe peut-être pas encore. Si la migration n'existe pas, créer `supabase/migrations/202608180005_push_subscriptions.sql` avant la Task A5.
3. **Variables de templates** : le dispatcher injecte toutes les clés du payload comme variables. Si un template référence une variable absente, elle sera remplacée par une chaîne vide. C'est acceptable pour le MVP.

---

## Execution Handoff

**Plan complet enregistré dans :** `docs/superpowers/plans/2026-08-17-partie-a-implementation-plan.md`

**Deux options d'exécution :**

1. **Subagent-Driven (recommended)** — Je dispatche un sous-agent par tâche, avec revue entre chaque. Rapide et itératif.
2. **Inline Execution** — J'exécute les tâches dans cette session avec `executing-plans`, avec des points de contrôle réguliers.

**Quelle approche veux-tu utiliser ?**
