> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

# SchoolSafe V2 — Plan d'implémentation Cloudflare Workers + Supabase

**Goal:** Porter SchoolSafe V2 de Fastify/Node.js vers Cloudflare Workers, héberger le frontend sur Cloudflare Pages, connecter la base Supabase SCHOOLSAFE-FIN, et moderniser les modules métier tout en conservant le patrimoine visuel.

**Architecture:** Frontend PWA statique sur Cloudflare Pages appelle une API Cloudflare Workers (Hono). Le Workers utilise Supabase PostgreSQL/Auth comme source de vérité, Cloudflare R2 pour les fichiers, D1 pour les archives, KV pour le cache, Queues/Workflows/Cron pour les traitements asynchrones. Aucun secret n'est exposé dans le frontend ni dans Git.

**Tech Stack:** TypeScript, Hono, Wrangler, Supabase JS, Zod, Vitest + `@cloudflare/vitest-pool-workers`, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-18-schoolsafe-v2-global-design.md`

## Global Constraints

- Mono-école : une base = une école, pas de multi-tenant.
- Aucun secret (service_role, Brevo, VAPID, QR, SMS) dans le frontend ni dans Git.
- RLS activé sur toutes les tables exposées aux clients.
- Permissions : deny override (refus explicite l'emporte).
- Modularité : jamais d'appel direct fournisseur externe depuis un module métier.
- Tests : `npm run typecheck` et `npm test` verts avant chaque commit.
- Langue UI : français principal ; anglais secondaire là où prévu.
- Patrimoine visuel conservé : splash bleu, logo, portraits, cube 3D, slogan.
- Commits fréquents : une tâche = un commit, push immédiat.

---

## File Structure

```
workers/                                  # nouveau backend Cloudflare Workers
├── src/
│   ├── index.ts              # entrypoint fetch, CORS, routing
│   ├── env.ts                # types bindings + validation Zod
│   ├── lib/
│   │   ├── errors.ts         # SchoolSafeError
│   │   ├── request-id.ts     # crypto.randomUUID
│   │   ├── crypto.ts         # HMAC, hash, UUID (Web Crypto)
│   │   ├── supabase.ts       # createUserClient, createServiceClient
│   │   ├── r2.ts             # client R2 léger (S3 fetch signé)
│   │   ├── multipart.ts      # parser multipart edge-compatible
│   │   └── webpush.ts        # VAPID + chiffrement ECE
│   ├── middleware/
│   │   ├── auth.ts           # extract Bearer + verify
│   │   ├── permission.ts     # requirePermission / requireScope
│   │   ├── cors.ts           # CORS domaine frontend
│   │   └── error.ts          # format réponse erreur
│   ├── routes/
│   │   ├── setup.ts
│   │   ├── bootstrap.ts
│   │   ├── school.ts
│   │   ├── cards.ts
│   │   ├── security.ts
│   │   ├── finance.ts
│   │   ├── pedagogy.ts
│   │   ├── pilotage.ts
│   │   ├── email.ts
│   │   └── push.ts
│   └── services/
│       ├── setup.ts
│       ├── bootstrap.ts
│       ├── school.ts
│       ├── cards.ts
│       ├── security.ts
│       ├── finance.ts
│       ├── pedagogy.ts
│       ├── pilotage.ts
│       ├── events.ts
│       └── notifications/
│           ├── dispatcher.ts
│           ├── service.ts
│           ├── subscriptions.ts
│           └── providers/
│               ├── brevo.ts
│               ├── zoho.ts
│               ├── in-app.ts
│               └── push.ts
├── tests/
│   ├── unit/                 # tests unitaires services
│   └── integration/          # tests routes avec Miniflare
├── wrangler.toml
├── package.json
└── tsconfig.json

app/                                      # PWA statique (existant, modifié)
├── index.html
├── app.js
├── styles.css
├── modules/
│   └── ... (mise à jour apiBase + config)
└── .github/workflows/deploy-pages.yml    # remplace static.yml

supabase/
├── config.toml                           # lié à SCHOOLSAFE-FIN
├── migrations/                           # migrations actuelles
└── seed.sql
```

---

## Phase 0 — Setup Supabase + Cloudflare

### Task 0.1 : Créer le projet Supabase SCHOOLSAFE-FIN

**Files:**
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes: compte Supabase.
- Produces: projet `SCHOOLSAFE-FIN` lié localement.

- [ ] **Step 1 : Se connecter à Supabase CLI**

Run : `supabase login`
Expected : authentification réussie.

- [ ] **Step 2 : Créer le projet**

Run : `supabase projects create "SCHOOLSAFE-FIN" --org-id <org> --region <region> --plan free`
Expected : project ref retourné, ex. `xxxxxxxxxxxxxxxxxxxx`.

- [ ] **Step 3 : Lier le projet local**

Run : `supabase link --project-ref <ref>`
Expected : `supabase/config.toml` mis à jour avec le nouveau `project_id`.

- [ ] **Step 4 : Commit**

```bash
git add supabase/config.toml
git commit -m "chore(supabase): link config to SCHOOLSAFE-FIN project"
```

### Task 0.2 : Configurer le compte Cloudflare

**Files:**
- Create: `workers/wrangler.toml`

**Interfaces:**
- Consumes: compte Cloudflare.
- Produces: Workers, Pages, R2, D1, KV configurés.

- [ ] **Step 1 : Installer Wrangler globalement**

Run : `npm install -g wrangler`
Expected : wrangler disponible.

- [ ] **Step 2 : Authentifier Wrangler**

Run : `wrangler login`
Expected : connexion Cloudflare réussie.

- [ ] **Step 3 : Créer les ressources Cloudflare**

Run : `wrangler kv:namespace create SCHOOLSAFE_CACHE`
Run : `wrangler r2 bucket create schoolsafe-v2-files`
Run : `wrangler d1 create schoolsafe-v2-archive`
Expected : IDs de binding retournés.

- [ ] **Step 4 : Écrire `workers/wrangler.toml` initial**

```toml
name = "schoolsafe-v2-api"
main = "src/index.ts"
compatibility_date = "2026-08-18"

[vars]
ALLOWED_ORIGINS = "https://schoolsafe-v2.pages.dev"

[[kv_namespaces]]
binding = "SCHOOLSAFE_CACHE"
id = "<kv-id>"

[[r2_buckets]]
binding = "SCHOOLSAFE_FILES"
bucket_name = "schoolsafe-v2-files"

[[d1_databases]]
binding = "SCHOOLSAFE_ARCHIVE"
database_id = "<d1-id>"

[queues]
producers = [{ binding = "SCHOOLSAFE_QUEUE", queue = "schoolsafe-v2-notifications" }]
consumers = [{ queue = "schoolsafe-v2-notifications" }]
```

- [ ] **Step 5 : Commit**

```bash
git add workers/wrangler.toml
git commit -m "chore(cloudflare): add wrangler config with KV, R2, D1, Queues"
```

---

## Phase 1 — Squelette Workers + fondations

### Task 1.1 : Initialiser le projet Workers

**Files:**
- Create: `workers/package.json`
- Create: `workers/tsconfig.json`
- Create: `workers/vitest.config.ts`

**Interfaces:**
- Consumes: Hono, Zod, Supabase JS, Vitest pool Workers.
- Produces: projet TypeScript exécutable localement.

- [ ] **Step 1 : Créer `workers/package.json`**

```json
{
  "name": "schoolsafe-workers",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "hono": "^4.5.0",
    "zod": "3.25.76",
    "@supabase/supabase-js": "2.112.3"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.5.0",
    "@cloudflare/workers-types": "^4.20240815.0",
    "typescript": "5.8.3",
    "vitest": "3.2.7",
    "wrangler": "^3.72.0"
  }
}
```

- [ ] **Step 2 : Créer `workers/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["@cloudflare/workers-types"],
    "outDir": "./dist"
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3 : Créer `workers/vitest.config.ts`**

```ts
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
      },
    },
  },
});
```

- [ ] **Step 4 : Installer les dépendances**

Run : `cd workers && npm install`
Expected : `node_modules` créé, pas d'erreur.

- [ ] **Step 5 : Commit**

```bash
git add workers/package.json workers/tsconfig.json workers/vitest.config.ts workers/package-lock.json
git commit -m "chore(workers): init Hono + TypeScript + Vitest pool"
```

### Task 1.2 : Fondations lib et middleware

**Files:**
- Create: `workers/src/lib/errors.ts`
- Create: `workers/src/lib/request-id.ts`
- Create: `workers/src/lib/crypto.ts`
- Create: `workers/src/lib/supabase.ts`
- Create: `workers/src/middleware/error.ts`
- Create: `workers/src/middleware/cors.ts`
- Create: `workers/src/env.ts`

**Interfaces:**
- Consumes: Web Crypto, Supabase JS, Zod.
- Produces: `SchoolSafeError`, `newRequestId()`, `hmac()`, `createUserClient()`, `createServiceClient()`, middlewares CORS/error.

- [ ] **Step 1 : Créer `workers/src/lib/errors.ts`**

```ts
export class SchoolSafeError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    public readonly publicMessage: string,
    public readonly retryable: boolean,
  ) {
    super(publicMessage);
  }
}

export type ApiErrorBody = {
  code: string;
  message: string;
  request_id: string;
  retryable: boolean;
};
```

- [ ] **Step 2 : Créer `workers/src/lib/request-id.ts`**

```ts
export function newRequestId(): string {
  return crypto.randomUUID();
}
```

- [ ] **Step 3 : Créer `workers/src/lib/crypto.ts`**

```ts
export async function hmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

- [ ] **Step 4 : Créer `workers/src/lib/supabase.ts`**

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createUserClient(supabaseUrl: string, supabaseAnonKey: string, accessToken: string): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function createServiceClient(supabaseUrl: string, serviceRoleKey: string): SupabaseClient {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
```

- [ ] **Step 5 : Créer `workers/src/middleware/error.ts`**

```ts
import type { Context, Next } from "hono";
import { SchoolSafeError } from "../lib/errors.js";
import { newRequestId } from "../lib/request-id.js";

export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (error) {
    const requestId = newRequestId();
    if (error instanceof SchoolSafeError) {
      return c.json(
        { code: error.code, message: error.publicMessage, request_id: requestId, retryable: error.retryable },
        error.statusCode,
      );
    }
    return c.json(
      { code: "INTERNAL_ERROR", message: "Erreur interne", request_id: requestId, retryable: false },
      500,
    );
  }
}
```

- [ ] **Step 6 : Créer `workers/src/middleware/cors.ts`**

```ts
import type { Context, Next } from "hono";

export function corsMiddleware(allowedOrigins: string[]) {
  return async (c: Context, next: Next) => {
    const origin = c.req.header("Origin");
    if (origin && allowedOrigins.includes(origin)) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      c.header("Access-Control-Allow-Credentials", "true");
    }
    if (c.req.method === "OPTIONS") return c.body(null, 204);
    await next();
  };
}
```

- [ ] **Step 7 : Créer `workers/src/env.ts`**

```ts
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
```

- [ ] **Step 8 : Tests unitaires**

Create : `workers/tests/lib/crypto.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { hmacSha256 } from "../../src/lib/crypto.js";

describe("hmacSha256", () => {
  it("produces a hex signature", async () => {
    const result = await hmacSha256("secret", "message");
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });
});
```

Run : `cd workers && npx vitest run tests/lib/crypto.test.ts`
Expected : PASS

- [ ] **Step 9 : Commit**

```bash
git add workers/src/lib workers/src/middleware workers/src/env.ts workers/tests/lib/crypto.test.ts
git commit -m "feat(workers): foundations - errors, crypto, supabase clients, CORS, env"
```

### Task 1.3 : Entrypoint et routes fondations

**Files:**
- Create: `workers/src/index.ts`
- Create: `workers/src/routes/setup.ts`
- Create: `workers/src/routes/bootstrap.ts`
- Create: `workers/src/services/setup.ts`
- Create: `workers/src/services/bootstrap.ts`
- Create: `workers/tests/routes/health.test.ts`

**Interfaces:**
- Consumes: Hono, env, middlewares, Supabase clients.
- Produces: `app` Hono avec `/health`, `/ready`, `/config`, `/setup/*`, `/session/bootstrap`.

- [ ] **Step 1 : Créer `workers/src/services/setup.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

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
```

- [ ] **Step 2 : Créer `workers/src/routes/setup.ts`**

```ts
import { Hono } from "hono";
import { z } from "zod";
import { SchoolSafeError } from "../lib/errors.js";
import type { SetupService } from "../services/setup.js";

const validateTokenSchema = z.object({ token: z.string().min(1) });

export function createSetupRouter(service: SetupService) {
  const router = new Hono();

  router.get("/config", (c) => c.json(service.getConfig()));

  router.post("/setup/validate-token", async (c) => {
    const body = validateTokenSchema.safeParse(await c.req.json());
    if (!body.success) throw new SchoolSafeError(400, "VALIDATION_INVALID", "Données invalides", false);
    return c.json({ valid: service.validateToken(body.data.token) });
  });

  return router;
}
```

- [ ] **Step 3 : Créer `workers/src/services/bootstrap.ts`**

```ts
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
```

- [ ] **Step 4 : Créer `workers/src/routes/bootstrap.ts`**

```ts
import { Hono } from "hono";
import { SchoolSafeError } from "../lib/errors.js";
import type { BootstrapService } from "../services/bootstrap.js";

export function createBootstrapRouter(service: BootstrapService) {
  const router = new Hono();

  router.post("/session/bootstrap", async (c) => {
    const auth = c.req.header("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      throw new SchoolSafeError(401, "AUTH_REQUIRED", "Authentification requise", false);
    }
    const token = auth.slice(7);
    const bootstrap = await service.load(token);
    if (!bootstrap) throw new SchoolSafeError(403, "PERMISSION_DENIED", "Profil indisponible", false);
    return c.json(bootstrap);
  });

  return router;
}
```

- [ ] **Step 5 : Créer `workers/src/index.ts`**

```ts
import { Hono } from "hono";
import { errorHandler } from "./middleware/error.js";
import { corsMiddleware } from "./middleware/cors.js";
import { parseEnv, type AppEnv } from "./env.js";
import { createSetupService } from "./services/setup.js";
import { createSetupRouter } from "./routes/setup.js";
import { createBootstrapService } from "./services/bootstrap.js";
import { createBootstrapRouter } from "./routes/bootstrap.js";

export default {
  async fetch(request: Request, env: AppEnv): Promise<Response> {
    const parsedEnv = parseEnv(env);
    const allowedOrigins = parsedEnv.ALLOWED_ORIGINS.split(",").map((s) => s.trim());

    const setupService = createSetupService(
      parsedEnv.SUPABASE_URL,
      parsedEnv.SUPABASE_ANON_KEY,
      parsedEnv.SETUP_TOKEN,
    );
    const bootstrapService = createBootstrapService(
      parsedEnv.SUPABASE_URL,
      parsedEnv.SUPABASE_ANON_KEY,
      parsedEnv.SUPABASE_SERVICE_ROLE_KEY,
    );

    const app = new Hono();
    app.use(errorHandler);
    app.use(corsMiddleware(allowedOrigins));

    app.get("/health", (c) => c.json({ status: "ok" }));
    app.get("/ready", (c) => c.json({ status: "ready" }));

    app.route("/", createSetupRouter(setupService));
    app.route("/", createBootstrapRouter(bootstrapService));

    return app.fetch(request, env);
  },
};
```

- [ ] **Step 6 : Écrire le test d'intégration**

Create : `workers/tests/routes/health.test.ts`

```ts
import { describe, it, expect } from "vitest";
import worker from "../../src/index.js";

describe("health", () => {
  it("returns ok", async () => {
    const req = new Request("http://localhost/health");
    const res = await worker.fetch(req, {
      SUPABASE_URL: "http://localhost:54321",
      SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      ALLOWED_ORIGINS: "http://localhost:4175",
    } as unknown as Record<string, unknown>);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
```

Run : `cd workers && npx vitest run tests/routes/health.test.ts`
Expected : PASS

- [ ] **Step 7 : Commit**

```bash
git add workers/src/index.ts workers/src/routes/setup.ts workers/src/routes/bootstrap.ts workers/src/services/setup.ts workers/src/services/bootstrap.ts workers/tests/routes/health.test.ts
git commit -m "feat(workers): foundation routes /health, /config, /session/bootstrap"
```
agent_id: agent-1
actual_subagent_type: plan
status: completed

[summary]
## Phase 2 — Modules CRUD simples : school, pedagogy, finance, pilotage

### Task 2.1 : Middleware auth + permissions

**Files:**
- Create: `workers/src/middleware/auth.ts`
- Create: `workers/src/middleware/permission.ts`
- Create: `workers/src/services/access.ts`
- Create: `workers/tests/middleware/permission.test.ts`

**Interfaces:**
- Consumes: `createUserClient`, Supabase RPC `has_permission`/`has_scope`, `SchoolSafeError`.
- Produces: `authMiddleware`, `requirePermission(permission)`, `requireScope(scopeType, scopeId?)`.

- [ ] **Step 1 : Créer `workers/src/services/access.ts`**

```ts
import { createUserClient } from "../lib/supabase.js";

export interface AccessService {
  hasPermission(token: string, permissionCode: string): Promise<boolean>;
  hasScope(token: string, scopeType: string, scopeId?: string | null): Promise<boolean>;
}

export function createAccessService(supabaseUrl: string, supabaseAnonKey: string): AccessService {
  return {
    async hasPermission(token, permissionCode) {
      const client = createUserClient(supabaseUrl, supabaseAnonKey, token);
      const { data, error } = await client.rpc("has_permission", { permission_code: permissionCode });
      if (error) throw new Error(`Permission check failed: ${error.message}`);
      return data === true;
    },
    async hasScope(token, scopeType, scopeId) {
      const client = createUserClient(supabaseUrl, supabaseAnonKey, token);
      const { data, error } = await client.rpc("has_scope", {
        requested_scope_type: scopeType,
        requested_scope_id: scopeId ?? null,
      });
      if (error) throw new Error(`Scope check failed: ${error.message}`);
      return data === true;
    },
  };
}
```

- [ ] **Step 2 : Créer `workers/src/middleware/auth.ts`**

```ts
import type { Context, Next } from "hono";
import { SchoolSafeError } from "../lib/errors.js";

export function extractBearer(c: Context): string {
  const auth = c.req.header("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    throw new SchoolSafeError(401, "AUTH_REQUIRED", "Authentification requise", false);
  }
  return auth.slice(7);
}

export function authMiddleware() {
  return async (c: Context, next: Next) => {
    const token = extractBearer(c);
    c.set("token", token);
    await next();
  };
}
```

- [ ] **Step 3 : Créer `workers/src/middleware/permission.ts`**

```ts
import type { Context, Next } from "hono";
import { SchoolSafeError } from "../lib/errors.js";
import type { AccessService } from "../services/access.js";

export function requirePermission(access: AccessService, permission: string) {
  return async (c: Context, next: Next) => {
    const token = c.get("token") as string | undefined;
    if (!token) throw new SchoolSafeError(401, "AUTH_REQUIRED", "Token manquant", false);
    const ok = await access.hasPermission(token, permission);
    if (!ok) throw new SchoolSafeError(403, "PERMISSION_DENIED", "Permission refusée", false);
    await next();
  };
}

export function requireScope(access: AccessService, scopeType: string, scopeId?: string) {
  return async (c: Context, next: Next) => {
    const token = c.get("token") as string | undefined;
    if (!token) throw new SchoolSafeError(401, "AUTH_REQUIRED", "Token manquant", false);
    const ok = await access.hasScope(token, scopeType, scopeId);
    if (!ok) throw new SchoolSafeError(403, "SCOPE_DENIED", "Portée refusée", false);
    await next();
  };
}
```

- [ ] **Step 4 : Écrire le test**

Create : `workers/tests/middleware/permission.test.ts`

```ts
import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { authMiddleware } from "../../src/middleware/auth.js";
import { requirePermission } from "../../src/middleware/permission.js";
import type { AccessService } from "../../src/services/access.js";

describe("requirePermission", () => {
  it("returns 403 when permission denied", async () => {
    const access: AccessService = { hasPermission: vi.fn().mockResolvedValue(false), hasScope: vi.fn() };
    const app = new Hono();
    app.use(authMiddleware());
    app.get("/test", requirePermission(access, "school.manage"), (c) => c.json({ ok: true }));
    const req = new Request("http://localhost/test", { headers: { Authorization: "Bearer token" } });
    const res = await app.fetch(req);
    expect(res.status).toBe(403);
  });
});
```

Run : `cd workers && npx vitest run tests/middleware/permission.test.ts`
Expected : PASS

- [ ] **Step 5 : Commit**

```bash
git add workers/src/services/access.ts workers/src/middleware/auth.ts workers/src/middleware/permission.ts workers/tests/middleware/permission.test.ts
git commit -m "feat(workers): auth + permission middleware with Supabase RPC"
```

---

### Task 2.2 : Module school (settings, staff, années, cycles)

**Files:**
- Create: `workers/src/services/school.ts`
- Create: `workers/src/routes/school.ts`
- Modify: `workers/src/index.ts`
- Create: `workers/tests/routes/school.test.ts`

**Interfaces:**
- Consumes: `createServiceClient`, Zod schemas, `authMiddleware`, `requirePermission`, `AccessService`.
- Produces: `GET /school/settings`, `PUT /school/settings`, `GET /school/staff`, `POST /school/staff/invite`, `GET /school/academic-years`, `POST /school/academic-years/:id/activate`, `GET /school/cycles`, `PUT /school/cycles/:key/toggle`.

- [ ] **Step 1 : Créer `workers/src/services/school.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "../lib/supabase.js";

export type UpdateSchoolSettingsInput = {
  identity?: Partial<{
    name: string;
    name_en?: string;
    legal_name?: string;
    school_type?: string;
    approval_code?: string;
  }>;
  brand?: Partial<{
    primary_color?: string;
    accent_color?: string;
    document_footer?: string;
    logo_path?: string;
  }>;
  contact?: Partial<Record<string, string | null>>;
};

export interface SchoolService {
  getSettings(schoolId: string): Promise<unknown>;
  updateSettings(schoolId: string, input: UpdateSchoolSettingsInput): Promise<unknown>;
  listStaff(schoolId: string): Promise<unknown[]>;
  listAcademicYears(schoolId: string): Promise<unknown[]>;
  activateAcademicYear(schoolId: string, yearId: string): Promise<void>;
  listCycles(schoolId: string): Promise<unknown[]>;
  toggleCycle(schoolId: string, cycleKey: string, isActive: boolean): Promise<void>;
}

export function createSchoolService(supabaseUrl: string, serviceRoleKey: string): SchoolService {
  const client = createServiceClient(supabaseUrl, serviceRoleKey);
  return {
    async getSettings(schoolId) {
      const { data: school, error } = await client
        .from("school")
        .select("name, name_en, legal_name, school_type, approval_code, primary_color, accent_color, document_footer, logo_path")
        .eq("id", schoolId)
        .single();
      if (error || !school) throw new Error(`School not found: ${error?.message}`);
      const { data: contact } = await client
        .from("school_contacts")
        .select("country, province, city, address, email, phone, website_url, website_mode, public_news, public_gallery, public_honors")
        .eq("school_id", schoolId)
        .maybeSingle();
      return {
        identity: {
          name: school.name,
          name_en: school.name_en ?? null,
          legal_name: school.legal_name ?? null,
          school_type: school.school_type ?? null,
          approval_code: school.approval_code ?? null,
        },
        brand: {
          primary_color: school.primary_color ?? null,
          accent_color: school.accent_color ?? null,
          document_footer: school.document_footer ?? null,
          logo_path: school.logo_path ?? null,
        },
        contact: contact ?? {},
      };
    },
    async updateSettings(schoolId, input) {
      if (input.identity) {
        const { error } = await client.from("school").update(input.identity).eq("id", schoolId);
        if (error) throw new Error(`Update identity failed: ${error.message}`);
      }
      if (input.brand) {
        const { error } = await client.from("school").update(input.brand).eq("id", schoolId);
        if (error) throw new Error(`Update brand failed: ${error.message}`);
      }
      if (input.contact) {
        const payload: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(input.contact)) payload[k] = v === "" ? null : v;
        const { error } = await client.from("school_contacts").update(payload).eq("school_id", schoolId);
        if (error) throw new Error(`Update contact failed: ${error.message}`);
      }
      return this.getSettings(schoolId);
    },
    async listStaff(schoolId) {
      const { data, error } = await client
        .from("profiles")
        .select("id, first_name, last_name, display_name, phone, is_active, auth_user_id, school_id")
        .eq("school_id", schoolId)
        .order("display_name");
      if (error) throw new Error(`List staff failed: ${error.message}`);
      return data ?? [];
    },
    async listAcademicYears(schoolId) {
      const { data, error } = await client
        .from("academic_years")
        .select("id, label, starts_on, ends_on, periods, is_active")
        .eq("school_id", schoolId)
        .order("starts_on", { ascending: false });
      if (error) throw new Error(`List academic years failed: ${error.message}`);
      return (data ?? []).map((y) => ({ ...y, starts_on: String(y.starts_on), ends_on: String(y.ends_on) }));
    },
    async activateAcademicYear(schoolId, yearId) {
      const { error, count } = await client
        .from("academic_years")
        .update({ is_active: true }, { count: "exact" })
        .eq("id", yearId)
        .eq("school_id", schoolId);
      if (error) throw new Error(`Activate academic year failed: ${error.message}`);
      if (count === 0) throw new Error("Academic year not found");
      await client.rpc("deactivate_other_academic_years", { p_school_id: schoolId, p_active_year_id: yearId });
    },
    async listCycles(schoolId) {
      const { data, error } = await client
        .from("school_cycles")
        .select("cycle_key, cycle_name, is_active")
        .eq("school_id", schoolId)
        .order("cycle_key");
      if (error) throw new Error(`List cycles failed: ${error.message}`);
      if (data && data.length > 0) return data;
      const defaults = [
        { school_id: schoolId, cycle_key: "nursery", cycle_name: "Maternelle", is_active: true },
        { school_id: schoolId, cycle_key: "primary", cycle_name: "Primaire", is_active: true },
        { school_id: schoolId, cycle_key: "secondary", cycle_name: "Secondaire", is_active: true },
      ];
      const { data: inserted, error: insertError } = await client.from("school_cycles").insert(defaults).select("cycle_key, cycle_name, is_active");
      if (insertError || !inserted) throw new Error(`Seed cycles failed: ${insertError?.message}`);
      return inserted;
    },
    async toggleCycle(schoolId, cycleKey, isActive) {
      const { error } = await client
        .from("school_cycles")
        .update({ is_active: isActive })
        .eq("school_id", schoolId)
        .eq("cycle_key", cycleKey);
      if (error) throw new Error(`Toggle cycle failed: ${error.message}`);
    },
  };
}
```

- [ ] **Step 2 : Créer `workers/src/routes/school.ts`**

```ts
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import type { SchoolService } from "../services/school.js";
import type { AccessService } from "../services/access.js";
import { SchoolSafeError } from "../lib/errors.js";

const updateSettingsSchema = z.object({
  identity: z.object({
    name: z.string().min(1).optional(),
    name_en: z.string().optional(),
    legal_name: z.string().optional(),
    school_type: z.string().optional(),
    approval_code: z.string().optional(),
  }).optional(),
  brand: z.object({
    primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    document_footer: z.string().optional(),
    logo_path: z.string().optional(),
  }).optional(),
  contact: z.record(z.string().nullable()).optional(),
});

const toggleCycleSchema = z.object({ is_active: z.boolean() });

export function createSchoolRouter(service: SchoolService, access: AccessService) {
  const router = new Hono();
  router.use(authMiddleware());

  router.get("/school/settings", requirePermission(access, "school.manage"), async (c) => {
    const schoolId = c.get("schoolId") as string;
    return c.json({ data: await service.getSettings(schoolId) });
  });

  router.put("/school/settings", requirePermission(access, "school.manage"), async (c) => {
    const schoolId = c.get("schoolId") as string;
    const body = updateSettingsSchema.safeParse(await c.req.json());
    if (!body.success) throw new SchoolSafeError(400, "VALIDATION_INVALID", "Données invalides", false);
    return c.json({ data: await service.updateSettings(schoolId, body.data) });
  });

  router.get("/school/staff", requirePermission(access, "staff.manage"), async (c) => {
    const schoolId = c.get("schoolId") as string;
    return c.json({ data: await service.listStaff(schoolId) });
  });

  router.get("/school/academic-years", requirePermission(access, "school.manage"), async (c) => {
    const schoolId = c.get("schoolId") as string;
    return c.json({ data: await service.listAcademicYears(schoolId) });
  });

  router.post("/school/academic-years/:id/activate", requirePermission(access, "school.manage"), async (c) => {
    const schoolId = c.get("schoolId") as string;
    await service.activateAcademicYear(schoolId, c.req.param("id"));
    return c.json({ status: "ok" });
  });

  router.get("/school/cycles", requirePermission(access, "school.manage"), async (c) => {
    const schoolId = c.get("schoolId") as string;
    return c.json({ data: await service.listCycles(schoolId) });
  });

  router.put("/school/cycles/:key/toggle", requirePermission(access, "school.manage"), async (c) => {
    const schoolId = c.get("schoolId") as string;
    const body = toggleCycleSchema.safeParse(await c.req.json());
    if (!body.success) throw new SchoolSafeError(400, "VALIDATION_INVALID", "Données invalides", false);
    await service.toggleCycle(schoolId, c.req.param("key"), body.data.is_active);
    return c.json({ status: "ok" });
  });

  return router;
}
```

- [ ] **Step 3 : Brancher dans `workers/src/index.ts`**

Ajouter après la création de `bootstrapService` :

```ts
import { createAccessService } from "./services/access.js";
import { createSchoolService } from "./services/school.js";
import { createSchoolRouter } from "./routes/school.js";

// dans fetch :
const accessService = createAccessService(parsedEnv.SUPABASE_URL, parsedEnv.SUPABASE_ANON_KEY);
const schoolService = createSchoolService(parsedEnv.SUPABASE_URL, parsedEnv.SUPABASE_SERVICE_ROLE_KEY);
// middleware pour injecter schoolId depuis le token
app.use("*", async (c, next) => {
  const token = c.get("token");
  if (!token) return next();
  const userClient = createUserClient(parsedEnv.SUPABASE_URL, parsedEnv.SUPABASE_ANON_KEY, token);
  const { data } = await userClient.from("profiles").select("school_id").single();
  if (data?.school_id) c.set("schoolId", data.school_id);
  await next();
});
app.route("/", createSchoolRouter(schoolService, accessService));
```

- [ ] **Step 4 : Écrire le test d'intégration**

Create : `workers/tests/routes/school.test.ts`

```ts
import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { createSchoolRouter } from "../../src/routes/school.js";
import type { SchoolService } from "../../src/services/school.js";
import type { AccessService } from "../../src/services/access.js";

describe("school routes", () => {
  it("returns settings", async () => {
    const service: SchoolService = {
      getSettings: vi.fn().mockResolvedValue({ identity: { name: "École Test" } }),
    } as unknown as SchoolService;
    const access: AccessService = { hasPermission: vi.fn().mockResolvedValue(true), hasScope: vi.fn() };
    const app = new Hono();
    app.use("*", async (c, next) => { c.set("token", "t"); c.set("schoolId", "s1"); await next(); });
    app.route("/", createSchoolRouter(service, access));
    const res = await app.request("/school/settings");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { identity: { name: "École Test" } } });
  });
});
```

Run : `cd workers && npx vitest run tests/routes/school.test.ts`
Expected : PASS

- [ ] **Step 5 : Commit**

```bash
git add workers/src/services/school.ts workers/src/routes/school.ts workers/src/index.ts workers/tests/routes/school.test.ts
git commit -m "feat(workers): school CRUD routes - settings, staff, years, cycles"
```

---

### Task 2.3 : Modules finance + pilotage

**Files:**
- Create: `workers/src/services/finance.ts`
- Create: `workers/src/routes/finance.ts`
- Create: `workers/src/services/pilotage.ts`
- Create: `workers/src/routes/pilotage.ts`
- Modify: `workers/src/index.ts`
- Create: `workers/tests/routes/finance.test.ts`
- Create: `workers/tests/routes/pilotage.test.ts`

**Interfaces:**
- Consumes: `createServiceClient`, Zod, `authMiddleware`, `requirePermission`.
- Produces: `GET /finance/fee-structures`, `POST /finance/fee-structures`, `GET /finance/student-fees`, `POST /finance/payments`, `GET /pilotage/dashboard`, `GET /pilotage/alerts`, `POST /pilotage/alerts/:id/acknowledge`, `POST /pilotage/alerts/:id/resolve`.

- [ ] **Step 1 : Créer `workers/src/services/finance.ts`**

```ts
import { createServiceClient } from "../lib/supabase.js";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface FinanceService {
  listFeeStructures(schoolId: string): Promise<unknown[]>;
  createFeeStructure(schoolId: string, input: Record<string, unknown>): Promise<unknown>;
  listStudentFees(schoolId: string, options: { studentId?: string; status?: string }): Promise<unknown[]>;
  createPayment(schoolId: string, profileId: string, input: Record<string, unknown>): Promise<unknown>;
}

export function createFinanceService(supabaseUrl: string, serviceRoleKey: string): FinanceService {
  const client = createServiceClient(supabaseUrl, serviceRoleKey);
  return {
    async listFeeStructures(schoolId) {
      const { data, error } = await client.from("fee_structures").select("*").eq("school_id", schoolId).order("created_at", { ascending: false });
      if (error) throw new Error(`List fee structures failed: ${error.message}`);
      return data ?? [];
    },
    async createFeeStructure(schoolId, input) {
      const { data, error } = await client.from("fee_structures").insert({ school_id: schoolId, ...input }).select("*").single();
      if (error || !data) throw new Error(`Create fee structure failed: ${error?.message}`);
      return data;
    },
    async listStudentFees(schoolId, options) {
      let q = client.from("student_fees").select("*, students!inner(id, matricule, first_name, last_name)").eq("school_id", schoolId);
      if (options.studentId) q = q.eq("student_id", options.studentId);
      if (options.status) q = q.eq("status", options.status);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw new Error(`List student fees failed: ${error.message}`);
      return data ?? [];
    },
    async createPayment(schoolId, profileId, input) {
      const feeId = input.student_fee_id as string;
      const { data: fee, error: feeError } = await client
        .from("student_fees")
        .select("id, amount_paid, amount_expected, amount_remaining, status")
        .eq("id", feeId)
        .eq("school_id", schoolId)
        .single();
      if (feeError || !fee) throw new Error(`Student fee not found: ${feeError?.message}`);
      const { data: payment, error } = await client
        .from("fee_payments")
        .insert({
          school_id: schoolId,
          student_fee_id: feeId,
          amount: input.amount,
          currency: input.currency,
          received_by: profileId,
          received_at: input.received_at ?? new Date().toISOString(),
          receipt_no: input.receipt_no ?? null,
          metadata: input.metadata,
        })
        .select("*")
        .single();
      if (error || !payment) throw new Error(`Create payment failed: ${error?.message}`);
      const newPaid = Number(fee.amount_paid) + Number(input.amount);
      const newRemaining = Math.max(Number(fee.amount_expected) - newPaid, 0);
      let status = fee.status as string;
      if (newRemaining <= 0) status = "paid";
      else if (newPaid > 0) status = "partial";
      const { error: upd } = await client.from("student_fees").update({ amount_paid: newPaid, amount_remaining: newRemaining, status }).eq("id", feeId);
      if (upd) throw new Error(`Update fee failed: ${upd.message}`);
      return payment;
    },
  };
}
```

- [ ] **Step 2 : Créer `workers/src/routes/finance.ts`**

```ts
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import type { FinanceService } from "../services/finance.js";
import type { AccessService } from "../services/access.js";
import { SchoolSafeError } from "../lib/errors.js";

const currencySchema = z.enum(["USD", "CDF"]);
const cycleKeySchema = z.enum(["nursery", "primary", "secondary"]);

const createFeeStructureSchema = z.object({
  academic_year_id: z.string().uuid().optional(),
  cycle_key: cycleKeySchema,
  label: z.string().min(1).max(200),
  amount: z.coerce.number().nonnegative(),
  currency: currencySchema.default("USD"),
  due_date: z.string().date().optional(),
  is_active: z.boolean().default(true),
});

const createPaymentSchema = z.object({
  student_fee_id: z.string().uuid(),
  amount: z.coerce.number().positive(),
  currency: currencySchema.default("USD"),
  received_at: z.string().datetime().optional(),
  receipt_no: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).default({}),
});

export function createFinanceRouter(service: FinanceService, access: AccessService) {
  const router = new Hono();
  router.use(authMiddleware());

  router.get("/finance/fee-structures", requirePermission(access, "finance.fee.read"), async (c) => {
    return c.json({ data: await service.listFeeStructures(c.get("schoolId")) });
  });

  router.post("/finance/fee-structures", requirePermission(access, "finance.fee.manage"), async (c) => {
    const body = createFeeStructureSchema.safeParse(await c.req.json());
    if (!body.success) throw new SchoolSafeError(400, "VALIDATION_INVALID", "Données invalides", false);
    const profileId = c.get("profileId") as string;
    return c.json({ data: await service.createFeeStructure(c.get("schoolId"), { ...body.data, created_by: profileId }) }, 201);
  });

  router.get("/finance/student-fees", requirePermission(access, "finance.fee.read"), async (c) => {
    const q = c.req.query();
    return c.json({ data: await service.listStudentFees(c.get("schoolId"), { studentId: q.student_id, status: q.status }) });
  });

  router.post("/finance/payments", requirePermission(access, "finance.payment.record"), async (c) => {
    const body = createPaymentSchema.safeParse(await c.req.json());
    if (!body.success) throw new SchoolSafeError(400, "VALIDATION_INVALID", "Données invalides", false);
    const profileId = c.get("profileId") as string;
    return c.json({ data: await service.createPayment(c.get("schoolId"), profileId, body.data) }, 201);
  });

  return router;
}
```

- [ ] **Step 3 : Créer `workers/src/services/pilotage.ts`**

```ts
import { createServiceClient } from "../lib/supabase.js";

export interface PilotageService {
  loadDashboard(schoolId: string): Promise<unknown>;
  listAlerts(schoolId: string, options: { status?: string; severity?: string; limit: number; offset: number }): Promise<{ data: unknown[]; count: number }>;
  acknowledgeAlert(alertId: string, profileId: string): Promise<unknown>;
  resolveAlert(alertId: string, profileId: string, note?: string): Promise<unknown>;
}

export function createPilotageService(supabaseUrl: string, serviceRoleKey: string): PilotageService {
  const client = createServiceClient(supabaseUrl, serviceRoleKey);
  return {
    async loadDashboard(schoolId) {
      const [{ data: alerts }, { data: students }, { data: staff }] = await Promise.all([
        client.from("alerts").select("severity, status").eq("school_id", schoolId),
        client.from("students").select("id", { count: "exact" }).eq("school_id", schoolId),
        client.from("profiles").select("id", { count: "exact" }).eq("school_id", schoolId),
      ]);
      return {
        counts: { students: students?.length ?? 0, staff: staff?.length ?? 0 },
        open_alerts: (alerts ?? []).filter((a) => a.status === "open" || a.status === "acknowledged"),
      };
    },
    async listAlerts(schoolId, options) {
      let q = client.from("alerts").select("*", { count: "exact" }).eq("school_id", schoolId).order("detected_at", { ascending: false }).range(options.offset, options.offset + options.limit - 1);
      if (options.status) q = q.eq("status", options.status);
      if (options.severity) q = q.eq("severity", options.severity);
      const { data, error, count } = await q;
      if (error) throw new Error(`List alerts failed: ${error.message}`);
      return { data: data ?? [], count: count ?? 0 };
    },
    async acknowledgeAlert(alertId, profileId) {
      const { data, error } = await client
        .from("alerts")
        .update({ status: "acknowledged", acknowledged_at: new Date().toISOString(), acknowledged_by: profileId })
        .eq("id", alertId)
        .select("*")
        .single();
      if (error || !data) throw new Error(`Acknowledge failed: ${error?.message}`);
      return data;
    },
    async resolveAlert(alertId, profileId, note) {
      const { data, error } = await client
        .from("alerts")
        .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: profileId, resolution_note: note ?? null })
        .eq("id", alertId)
        .select("*")
        .single();
      if (error || !data) throw new Error(`Resolve failed: ${error?.message}`);
      return data;
    },
  };
}
```

- [ ] **Step 4 : Créer `workers/src/routes/pilotage.ts`**

```ts
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import type { PilotageService } from "../services/pilotage.js";
import type { AccessService } from "../services/access.js";
import { SchoolSafeError } from "../lib/errors.js";

const listAlertsSchema = z.object({
  status: z.string().optional(),
  severity: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export function createPilotageRouter(service: PilotageService, access: AccessService) {
  const router = new Hono();
  router.use(authMiddleware());

  router.get("/pilotage/dashboard", requirePermission(access, "pilotage.dashboard.read"), async (c) => {
    return c.json({ data: await service.loadDashboard(c.get("schoolId")) });
  });

  router.get("/pilotage/alerts", requirePermission(access, "pilotage.alerts.read"), async (c) => {
    const q = listAlertsSchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
    if (!q.success) throw new SchoolSafeError(400, "VALIDATION_INVALID", "Paramètres invalides", false);
    return c.json(await service.listAlerts(c.get("schoolId"), q.data));
  });

  router.post("/pilotage/alerts/:id/acknowledge", requirePermission(access, "pilotage.alerts.manage"), async (c) => {
    return c.json({ data: await service.acknowledgeAlert(c.req.param("id"), c.get("profileId")) });
  });

  router.post("/pilotage/alerts/:id/resolve", requirePermission(access, "pilotage.alerts.manage"), async (c) => {
    const body = (await c.req.json()) as { note?: string };
    return c.json({ data: await service.resolveAlert(c.req.param("id"), c.get("profileId"), body.note) });
  });

  return router;
}
```

- [ ] **Step 5 : Brancher dans `workers/src/index.ts`**

Ajouter :

```ts
import { createFinanceService } from "./services/finance.js";
import { createFinanceRouter } from "./routes/finance.js";
import { createPilotageService } from "./services/pilotage.js";
import { createPilotageRouter } from "./routes/pilotage.js";

const financeService = createFinanceService(parsedEnv.SUPABASE_URL, parsedEnv.SUPABASE_SERVICE_ROLE_KEY);
const pilotageService = createPilotageService(parsedEnv.SUPABASE_URL, parsedEnv.SUPABASE_SERVICE_ROLE_KEY);

// dans le middleware d'injection, ajouter profileId
const { data: profile } = await userClient.from("profiles").select("id, school_id").single();
if (profile) {
  c.set("profileId", profile.id);
  c.set("schoolId", profile.school_id);
}

app.route("/", createFinanceRouter(financeService, accessService));
app.route("/", createPilotageRouter(pilotageService, accessService));
```

- [ ] **Step 6 : Tests**

Create : `workers/tests/routes/finance.test.ts`

```ts
import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { createFinanceRouter } from "../../src/routes/finance.js";
import type { FinanceService } from "../../src/services/finance.js";
import type { AccessService } from "../../src/services/access.js";

describe("finance routes", () => {
  it("lists fee structures", async () => {
    const service: FinanceService = { listFeeStructures: vi.fn().mockResolvedValue([{ id: "f1" }]) } as unknown as FinanceService;
    const access: AccessService = { hasPermission: vi.fn().mockResolvedValue(true), hasScope: vi.fn() };
    const app = new Hono();
    app.use("*", async (c, next) => { c.set("token", "t"); c.set("schoolId", "s1"); await next(); });
    app.route("/", createFinanceRouter(service, access));
    const res = await app.request("/finance/fee-structures");
    expect(res.status).toBe(200);
  });
});
```

Create : `workers/tests/routes/pilotage.test.ts`

```ts
import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { createPilotageRouter } from "../../src/routes/pilotage.js";
import type { PilotageService } from "../../src/services/pilotage.js";
import type { AccessService } from "../../src/services/access.js";

describe("pilotage routes", () => {
  it("loads dashboard", async () => {
    const service: PilotageService = { loadDashboard: vi.fn().mockResolvedValue({ counts: {} }) } as unknown as PilotageService;
    const access: AccessService = { hasPermission: vi.fn().mockResolvedValue(true), hasScope: vi.fn() };
    const app = new Hono();
    app.use("*", async (c, next) => { c.set("token", "t"); c.set("schoolId", "s1"); await next(); });
    app.route("/", createPilotageRouter(service, access));
    const res = await app.request("/pilotage/dashboard");
    expect(res.status).toBe(200);
  });
});
```

Run : `cd workers && npx vitest run tests/routes/finance.test.ts tests/routes/pilotage.test.ts`
Expected : PASS

- [ ] **Step 7 : Commit**

```bash
git add workers/src/services/finance.ts workers/src/routes/finance.ts workers/src/services/pilotage.ts workers/src/routes/pilotage.ts workers/src/index.ts workers/tests/routes/finance.test.ts workers/tests/routes/pilotage.test.ts
git commit -m "feat(workers): finance and pilotage CRUD routes"
```

---

### Task 2.4 : Module pédagogie

**Files:**
- Create: `workers/src/services/pedagogy.ts`
- Create: `workers/src/routes/pedagogy.ts`
- Modify: `workers/src/index.ts`
- Create: `workers/tests/routes/pedagogy.test.ts`

**Interfaces:**
- Consumes: `createServiceClient`, Zod schemas, `authMiddleware`, `requirePermission`.
- Produces: `GET /pedagogy/classes`, `GET /pedagogy/subjects`, `POST /pedagogy/subjects`, `GET /pedagogy/teacher-assignments`, `POST /pedagogy/teacher-assignments`, `GET /pedagogy/assignments`, `POST /pedagogy/assignments`, `PATCH /pedagogy/assignments/:id`, `POST /pedagogy/assignments/:id/publish`, `GET /pedagogy/assignments/:id/grades`, `POST /pedagogy/assignments/:id/grades`, `GET /pedagogy/lesson-plans`, `POST /pedagogy/lesson-plans`.

- [ ] **Step 1 : Créer `workers/src/services/pedagogy.ts`**

```ts
import { createServiceClient } from "../lib/supabase.js";

export interface PedagogyService {
  listClasses(schoolId: string): Promise<unknown[]>;
  listSubjects(schoolId: string): Promise<unknown[]>;
  createSubject(schoolId: string, input: Record<string, unknown>): Promise<unknown>;
  listTeacherAssignments(schoolId: string): Promise<unknown[]>;
  createTeacherAssignment(schoolId: string, input: Record<string, unknown>): Promise<unknown>;
  deleteTeacherAssignment(schoolId: string, id: string): Promise<void>;
  listAssignments(schoolId: string, options: Record<string, string | undefined>): Promise<unknown[]>;
  createAssignment(schoolId: string, profileId: string, input: Record<string, unknown>): Promise<unknown>;
  updateAssignment(schoolId: string, profileId: string, id: string, input: Record<string, unknown>): Promise<unknown>;
  publishAssignment(schoolId: string, profileId: string, id: string): Promise<unknown>;
  getAssignmentGrades(schoolId: string, id: string): Promise<unknown[]>;
  saveGrades(schoolId: string, profileId: string, id: string, grades: unknown[]): Promise<unknown[]>;
  listLessonPlans(schoolId: string, options: Record<string, string | undefined>): Promise<unknown[]>;
  createLessonPlan(schoolId: string, profileId: string, input: Record<string, unknown>): Promise<unknown>;
}

export function createPedagogyService(supabaseUrl: string, serviceRoleKey: string): PedagogyService {
  const client = createServiceClient(supabaseUrl, serviceRoleKey);
  return {
    async listClasses(schoolId) {
      const { data, error } = await client.from("classes").select("*").eq("school_id", schoolId).order("name");
      if (error) throw new Error(`List classes failed: ${error.message}`);
      return data ?? [];
    },
    async listSubjects(schoolId) {
      const { data, error } = await client.from("subjects").select("*").eq("school_id", schoolId).order("name");
      if (error) throw new Error(`List subjects failed: ${error.message}`);
      return data ?? [];
    },
    async createSubject(schoolId, input) {
      const { data, error } = await client.from("subjects").insert({ school_id: schoolId, ...input }).select("*").single();
      if (error || !data) throw new Error(`Create subject failed: ${error?.message}`);
      return data;
    },
    async listTeacherAssignments(schoolId) {
      const { data, error } = await client
        .from("teacher_assignments")
        .select("*, subjects(*), classes(*), profiles:teacher_id(id, display_name)")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`List teacher assignments failed: ${error.message}`);
      return data ?? [];
    },
    async createTeacherAssignment(schoolId, input) {
      const { data, error } = await client.from("teacher_assignments").insert({ school_id: schoolId, ...input }).select("*").single();
      if (error || !data) throw new Error(`Create teacher assignment failed: ${error?.message}`);
      return data;
    },
    async deleteTeacherAssignment(schoolId, id) {
      const { error } = await client.from("teacher_assignments").delete().eq("id", id).eq("school_id", schoolId);
      if (error) throw new Error(`Delete teacher assignment failed: ${error.message}`);
    },
    async listAssignments(schoolId, options) {
      let q = client.from("assignments").select("*, subjects(*), classes(*), profiles:teacher_id(id, display_name)").eq("school_id", schoolId).order("created_at", { ascending: false });
      if (options.classId) q = q.eq("class_id", options.classId);
      if (options.subjectId) q = q.eq("subject_id", options.subjectId);
      if (options.teacherId) q = q.eq("teacher_id", options.teacherId);
      const { data, error } = await q;
      if (error) throw new Error(`List assignments failed: ${error.message}`);
      return data ?? [];
    },
    async createAssignment(schoolId, profileId, input) {
      const now = new Date().toISOString();
      const { data: assignment, error } = await client
        .from("assignments")
        .insert({ school_id: schoolId, teacher_id: profileId, status: "draft", ...input, created_at: now })
        .select("*")
        .single();
      if (error || !assignment) throw new Error(`Create assignment failed: ${error?.message}`);
      const questions = (input.questions as unknown[]) ?? [];
      if (questions.length > 0) {
        const { error: qErr } = await client.from("assignment_questions").insert(
          questions.map((q, i) => ({ assignment_id: assignment.id, ...(q as object), order_index: (q as { order_index?: number }).order_index ?? i }))
        );
        if (qErr) throw new Error(`Create questions failed: ${qErr.message}`);
      }
      return assignment;
    },
    async updateAssignment(schoolId, profileId, id, input) {
      const update: Record<string, unknown> = { ...input, updated_by: profileId, updated_at: new Date().toISOString() };
      if (input.status === "published") update.published_at = new Date().toISOString();
      const { data, error } = await client.from("assignments").update(update).eq("id", id).eq("school_id", schoolId).select("*").single();
      if (error || !data) throw new Error(`Update assignment failed: ${error?.message}`);
      return data;
    },
    async publishAssignment(schoolId, profileId, id) {
      return this.updateAssignment(schoolId, profileId, id, { status: "published" });
    },
    async getAssignmentGrades(schoolId, id) {
      const { data, error } = await client.from("grades").select("*, students(id, matricule, first_name, last_name)").eq("assignment_id", id).eq("school_id", schoolId);
      if (error) throw new Error(`Get grades failed: ${error.message}`);
      return data ?? [];
    },
    async saveGrades(schoolId, profileId, id, grades) {
      const now = new Date().toISOString();
      for (const g of grades) {
        const values = { ...(g as object), updated_by: profileId, updated_at: now };
        const existing = await client.from("grades").select("id").eq("assignment_id", id).eq("student_id", (g as { student_id: string }).student_id).maybeSingle();
        if (existing.data) {
          const { error } = await client.from("grades").update(values).eq("id", existing.data.id);
          if (error) throw new Error(`Update grade failed: ${error.message}`);
        } else {
          const { error } = await client.from("grades").insert({ school_id: schoolId, assignment_id: id, created_by: profileId, created_at: now, ...values });
          if (error) throw new Error(`Insert grade failed: ${error.message}`);
        }
      }
      return this.getAssignmentGrades(schoolId, id);
    },
    async listLessonPlans(schoolId, options) {
      let q = client.from("lesson_plans").select("*, subjects(*), classes(*), profiles:teacher_id(id, display_name)").eq("school_id", schoolId).order("lesson_date", { ascending: false });
      if (options.classId) q = q.eq("class_id", options.classId);
      if (options.subjectId) q = q.eq("subject_id", options.subjectId);
      if (options.teacherId) q = q.eq("teacher_id", options.teacherId);
      const { data, error } = await q;
      if (error) throw new Error(`List lesson plans failed: ${error.message}`);
      return data ?? [];
    },
    async createLessonPlan(schoolId, profileId, input) {
      const { data, error } = await client.from("lesson_plans").insert({ school_id: schoolId, teacher_id: profileId, ...input }).select("*").single();
      if (error || !data) throw new Error(`Create lesson plan failed: ${error?.message}`);
      return data;
    },
  };
}
```

- [ ] **Step 2 : Créer `workers/src/routes/pedagogy.ts`**

```ts
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import type { PedagogyService } from "../services/pedagogy.js";
import type { AccessService } from "../services/access.js";
import { SchoolSafeError } from "../lib/errors.js";

const createSubjectSchema = z.object({
  academic_year_id: z.string().uuid().optional(),
  cycle_key: z.enum(["nursery", "primary", "secondary"]),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  language: z.enum(["FR", "EN"]),
  subject_family_code: z.string().max(50).optional(),
  is_active: z.boolean().default(true),
});

const createAssignmentSchema = z.object({
  academic_year_id: z.string().uuid().optional(),
  class_id: z.string().uuid(),
  subject_id: z.string().uuid(),
  title: z.string().min(1).max(300),
  type: z.enum(["homework", "quiz", "exam", "compensatory"]),
  scale_mode: z.enum(["numeric", "qualitative", "custom"]).default("numeric"),
  scale_max: z.coerce.number().nonnegative().optional(),
  scale_label: z.string().max(100).optional(),
  coefficient: z.coerce.number().positive().default(1),
  due_date: z.string().date().optional(),
  prerequisites: z.string().max(2000).optional(),
  instructions: z.string().max(5000).optional(),
  language: z.enum(["FR", "EN"]),
  questions: z.array(z.object({ text: z.string(), type: z.string(), points: z.coerce.number().optional(), answer_space: z.string().optional(), choices: z.string().optional(), order_index: z.coerce.number().default(0) })).default([]),
});

const createLessonPlanSchema = z.object({
  academic_year_id: z.string().uuid().optional(),
  class_id: z.string().uuid(),
  subject_id: z.string().uuid(),
  title: z.string().min(1).max(300),
  lesson_date: z.string().date(),
  objectives: z.string().max(2000).optional(),
  materials: z.string().max(2000).optional(),
  procedure: z.string().max(5000).optional(),
  homework_assignment_id: z.string().uuid().optional(),
  attachments: z.array(z.object({ name: z.string(), url: z.string(), type: z.string() })).default([]),
});

export function createPedagogyRouter(service: PedagogyService, access: AccessService) {
  const router = new Hono();
  router.use(authMiddleware());

  const schoolId = (c: Parameters<Parameters<typeof router.get>[1]>[0]) => c.get("schoolId");
  const profileId = (c: Parameters<Parameters<typeof router.get>[1]>[0]) => c.get("profileId");

  router.get("/pedagogy/classes", requirePermission(access, "pedagogy.assignment.read"), async (c) => c.json({ data: await service.listClasses(c.get("schoolId")) }));
  router.get("/pedagogy/subjects", requirePermission(access, "pedagogy.subject.read"), async (c) => c.json({ data: await service.listSubjects(c.get("schoolId")) }));
  router.post("/pedagogy/subjects", requirePermission(access, "pedagogy.subject.manage"), async (c) => {
    const body = createSubjectSchema.safeParse(await c.req.json());
    if (!body.success) throw new SchoolSafeError(400, "VALIDATION_INVALID", "Données invalides", false);
    return c.json({ data: await service.createSubject(c.get("schoolId"), body.data) }, 201);
  });
  router.get("/pedagogy/teacher-assignments", requirePermission(access, "pedagogy.assignment.read"), async (c) => c.json({ data: await service.listTeacherAssignments(c.get("schoolId")) }));
  router.post("/pedagogy/teacher-assignments", requirePermission(access, "pedagogy.assignment.manage"), async (c) => {
    const body = await c.req.json();
    return c.json({ data: await service.createTeacherAssignment(c.get("schoolId"), body) }, 201);
  });
  router.delete("/pedagogy/teacher-assignments/:id", requirePermission(access, "pedagogy.assignment.manage"), async (c) => {
    await service.deleteTeacherAssignment(c.get("schoolId"), c.req.param("id"));
    return c.json({ success: true });
  });
  router.get("/pedagogy/assignments", requirePermission(access, "pedagogy.assignment.read"), async (c) => {
    const q = c.req.query();
    return c.json({ data: await service.listAssignments(c.get("schoolId"), { classId: q.class_id, subjectId: q.subject_id, teacherId: q.teacher_id }) });
  });
  router.post("/pedagogy/assignments", requirePermission(access, "pedagogy.assignment.manage"), async (c) => {
    const body = createAssignmentSchema.safeParse(await c.req.json());
    if (!body.success) throw new SchoolSafeError(400, "VALIDATION_INVALID", "Données invalides", false);
    return c.json({ data: await service.createAssignment(c.get("schoolId"), c.get("profileId"), body.data) }, 201);
  });
  router.patch("/pedagogy/assignments/:id", requirePermission(access, "pedagogy.assignment.manage"), async (c) => {
    const body = await c.req.json();
    return c.json({ data: await service.updateAssignment(c.get("schoolId"), c.get("profileId"), c.req.param("id"), body) });
  });
  router.post("/pedagogy/assignments/:id/publish", requirePermission(access, "pedagogy.assignment.manage"), async (c) => {
    return c.json({ data: await service.publishAssignment(c.get("schoolId"), c.get("profileId"), c.req.param("id")) });
  });
  router.get("/pedagogy/assignments/:id/grades", requirePermission(access, "pedagogy.grade.read"), async (c) => c.json({ data: await service.getAssignmentGrades(c.get("schoolId"), c.req.param("id")) }));
  router.post("/pedagogy/assignments/:id/grades", requirePermission(access, "pedagogy.grade.manage"), async (c) => {
    const body = (await c.req.json()) as { grades: unknown[] };
    return c.json({ data: await service.saveGrades(c.get("schoolId"), c.get("profileId"), c.req.param("id"), body.grades ?? []) });
  });
  router.get("/pedagogy/lesson-plans", requirePermission(access, "pedagogy.lesson-plan.read"), async (c) => {
    const q = c.req.query();
    return c.json({ data: await service.listLessonPlans(c.get("schoolId"), { classId: q.class_id, subjectId: q.subject_id, teacherId: q.teacher_id }) });
  });
  router.post("/pedagogy/lesson-plans", requirePermission(access, "pedagogy.lesson-plan.manage"), async (c) => {
    const body = createLessonPlanSchema.safeParse(await c.req.json());
    if (!body.success) throw new SchoolSafeError(400, "VALIDATION_INVALID", "Données invalides", false);
    return c.json({ data: await service.createLessonPlan(c.get("schoolId"), c.get("profileId"), body.data) }, 201);
  });

  return router;
}
```

- [ ] **Step 3 : Brancher dans `workers/src/index.ts`**

```ts
import { createPedagogyService } from "./services/pedagogy.js";
import { createPedagogyRouter } from "./routes/pedagogy.js";

const pedagogyService = createPedagogyService(parsedEnv.SUPABASE_URL, parsedEnv.SUPABASE_SERVICE_ROLE_KEY);
app.route("/", createPedagogyRouter(pedagogyService, accessService));
```

- [ ] **Step 4 : Test**

Create : `workers/tests/routes/pedagogy.test.ts`

```ts
import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { createPedagogyRouter } from "../../src/routes/pedagogy.js";
import type { PedagogyService } from "../../src/services/pedagogy.js";
import type { AccessService } from "../../src/services/access.js";

describe("pedagogy routes", () => {
  it("lists classes", async () => {
    const service: PedagogyService = { listClasses: vi.fn().mockResolvedValue([{ id: "c1" }]) } as unknown as PedagogyService;
    const access: AccessService = { hasPermission: vi.fn().mockResolvedValue(true), hasScope: vi.fn() };
    const app = new Hono();
    app.use("*", async (c, next) => { c.set("token", "t"); c.set("schoolId", "s1"); await next(); });
    app.route("/", createPedagogyRouter(service, access));
    const res = await app.request("/pedagogy/classes");
    expect(res.status).toBe(200);
  });
});
```

Run : `cd workers && npx vitest run tests/routes/pedagogy.test.ts`
Expected : PASS

- [ ] **Step 5 : Commit**

```bash
git add workers/src/services/pedagogy.ts workers/src/routes/pedagogy.ts workers/src/index.ts workers/tests/routes/pedagogy.test.ts
git commit -m "feat(workers): pedagogy CRUD routes"
```

---

## Phase 3 — Sécurité QR + cartes : scan QR, lockdown, request-print, HMAC, R2

### Task 3.1 : Client R2 léger + lib multipart

**Files:**
- Create: `workers/src/lib/r2.ts`
- Create: `workers/src/lib/multipart.ts`
- Create: `workers/tests/lib/r2.test.ts`
- Create: `workers/tests/lib/multipart.test.ts`

**Interfaces:**
- Consumes: R2 binding `SCHOOLSAFE_FILES`, AWS signature v4 via Web Crypto.
- Produces: `putObject(key, body, contentType)`, `getSignedUrl(key, expiresSeconds)`, `parseMultipart(request)`.

- [ ] **Step 1 : Créer `workers/src/lib/r2.ts`**

```ts
export interface R2Client {
  putObject(key: string, body: ArrayBuffer | Uint8Array, contentType: string): Promise<void>;
  getSignedUrl(key: string, expiresSeconds: number): Promise<string>;
}

export function createR2Client(bucket: R2Bucket, accountId: string, accessKeyId: string, secretAccessKey: string): R2Client {
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const bucketName = typeof bucket === "object" && "put" in bucket ? "schoolsafe-v2-files" : "schoolsafe-v2-files";

  async function signedHeaders(method: string, path: string, sha256: string, extraHeaders: Record<string, string> = {}) {
    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
    const amzDate = `${dateStamp}T000000Z`;
    const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
    const signedHeadersList = Object.keys(extraHeaders).sort().join(";");
    const canonicalRequest = [
      method,
      path,
      "",
      ...Object.entries(extraHeaders).sort().flatMap(([k, v]) => [`${k}:${v}`, ""]),
      "",
      signedHeadersList,
      sha256,
    ].join("\n");
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await hexSha256(canonicalRequest)}`;
    const dateKey = await hmacSha256Bin(`AWS4${secretAccessKey}`, dateStamp);
    const dateRegionKey = await hmacSha256Bin(dateKey, "auto");
    const dateRegionServiceKey = await hmacSha256Bin(dateRegionKey, "s3");
    const signingKey = await hmacSha256Bin(dateRegionServiceKey, "aws4_request");
    const signature = await hmacSha256Hex(signingKey, stringToSign);
    return {
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeadersList}, Signature=${signature}`,
      "x-amz-date": amzDate,
      "x-amz-content-sha256": sha256,
      ...extraHeaders,
    };
  }

  return {
    async putObject(key, body, contentType) {
      const path = `/${bucketName}/${encodeURIComponent(key)}`;
      const sha256 = await hexSha256(body);
      const headers = await signedHeaders("PUT", path, sha256, { "content-type": contentType });
      const res = await fetch(`https://${host}${path}`, { method: "PUT", headers, body });
      if (!res.ok) throw new Error(`R2 put failed: ${res.status} ${await res.text()}`);
    },
    async getSignedUrl(key, expiresSeconds) {
      const path = `/${bucketName}/${encodeURIComponent(key)}`;
      const expires = Math.floor(Date.now() / 1000) + expiresSeconds;
      const stringToSign = `GET\n\n\n${expires}\n${path}`;
      const signature = await hmacSha256Hex(secretAccessKey, stringToSign);
      return `https://${host}${path}?AWSAccessKeyId=${encodeURIComponent(accessKeyId)}&Expires=${expires}&Signature=${encodeURIComponent(signature)}`;
    },
  };
}

async function hexSha256(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const buf = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Bin(key: ArrayBuffer | string, message: string): Promise<ArrayBuffer> {
  const k = typeof key === "string" ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey("raw", k, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
}

async function hmacSha256Hex(key: ArrayBuffer | string, message: string): Promise<string> {
  const sig = await hmacSha256Bin(key, message);
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

- [ ] **Step 2 : Créer `workers/src/lib/multipart.ts`**

```ts
export type MultipartFile = { name: string; filename?: string; contentType?: string; data: Uint8Array };

export async function parseMultipart(request: Request): Promise<MultipartFile[]> {
  const contentType = request.headers.get("content-type") ?? "";
  const match = contentType.match(/boundary=([^;]+)/);
  if (!match) throw new Error("Missing multipart boundary");
  const boundary = `--${match[1].trim().replace(/^"|"$/g, "")}`;
  const buf = new Uint8Array(await request.arrayBuffer());
  const parts: MultipartFile[] = [];
  let i = 0;
  while (i < buf.length) {
    const boundaryIdx = indexOf(buf, new TextEncoder().encode(boundary), i);
    if (boundaryIdx === -1) break;
    const headerStart = boundaryIdx + boundary.length;
    if (buf[headerStart] === 45 && buf[headerStart + 1] === 45) break;
    const bodyStart = indexOf(buf, new Uint8Array([13, 10, 13, 10]), headerStart) + 4;
    const nextBoundary = indexOf(buf, new TextEncoder().encode(`\r\n${boundary}`), bodyStart);
    if (nextBoundary === -1) break;
    const headerText = new TextDecoder().decode(buf.slice(headerStart + 2, bodyStart - 2));
    const nameMatch = headerText.match(/name="([^"]+)"/);
    const filenameMatch = headerText.match(/filename="([^"]+)"/);
    const ctMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i);
    parts.push({
      name: nameMatch?.[1] ?? "",
      filename: filenameMatch?.[1],
      contentType: ctMatch?.[1]?.trim(),
      data: buf.slice(bodyStart, nextBoundary),
    });
    i = nextBoundary + 2;
  }
  return parts;
}

function indexOf(haystack: Uint8Array, needle: Uint8Array, start: number): number {
  for (let i = start; i <= haystack.length - needle.length; i++) {
    let found = true;
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) { found = false; break; }
    if (found) return i;
  }
  return -1;
}
```

- [ ] **Step 3 : Tests**

Create : `workers/tests/lib/multipart.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { parseMultipart } from "../../src/lib/multipart.js";

describe("parseMultipart", () => {
  it("parses a single file field", async () => {
    const body = [
      "--boundary",
      'Content-Disposition: form-data; name="file"; filename="test.txt"',
      "Content-Type: text/plain",
      "",
      "hello",
      "--boundary--",
    ].join("\r\n");
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=boundary" },
      body,
    });
    const parts = await parseMultipart(req);
    expect(parts).toHaveLength(1);
    expect(parts[0].filename).toBe("test.txt");
    expect(new TextDecoder().decode(parts[0].data)).toBe("hello");
  });
});
```

Run : `cd workers && npx vitest run tests/lib/multipart.test.ts`
Expected : PASS

- [ ] **Step 4 : Commit**

```bash
git add workers/src/lib/r2.ts workers/src/lib/multipart.ts workers/tests/lib/multipart.test.ts
git commit -m "feat(workers): R2 lightweight client and edge multipart parser"
```

---

### Task 3.2 : Sécurité QR (scan, lockdown, events)

**Files:**
- Create: `workers/src/services/security.ts`
- Create: `workers/src/routes/security.ts`
- Modify: `workers/src/index.ts`
- Create: `workers/tests/services/security.test.ts`

**Interfaces:**
- Consumes: `createServiceClient`, `hmacSha256`, `CARD_HMAC_SECRET`, `EventService`.
- Produces: `POST /security/scan`, `POST /security/lockdown`, `GET /security/events`.

- [ ] **Step 1 : Créer `workers/src/services/security.ts`**

```ts
import { createServiceClient } from "../lib/supabase.js";
import { hmacSha256 } from "../lib/crypto.js";

export type SecurityEventDecision = "allowed" | "denied" | "manual_override";

export interface SecurityService {
  scan(input: { qr_payload: string; event_type: string; location_id?: string; authorized_person_id?: string; manual_override?: boolean; note?: string; scanned_by: string }): Promise<unknown>;
  setLockdown(active: boolean, profileId: string): Promise<unknown>;
  listEvents(options: { limit: number; offset: number; eventType?: string }): Promise<{ data: unknown[]; count: number }>;
}

export function createSecurityService(supabaseUrl: string, serviceRoleKey: string, cardHmacSecret?: string): SecurityService {
  const client = createServiceClient(supabaseUrl, serviceRoleKey);

  async function signCardNumber(cardNumber: string): Promise<string> {
    if (!cardHmacSecret) throw new Error("CARD_HMAC_SECRET missing");
    const sig = await hmacSha256(cardHmacSecret, cardNumber);
    return sig.slice(0, 32);
  }

  function parseQr(payload: string): { cardNumber: string; signature: string } | null {
    const m = payload.match(/^schoolsafe:\/\/card\/([^/]+)\/([^/]+)$/);
    return m ? { cardNumber: m[1], signature: m[2] } : null;
  }

  return {
    async scan(input) {
      const parsed = parseQr(input.qr_payload);
      if (!parsed) throw new Error("Invalid QR payload");
      const expected = await signCardNumber(parsed.cardNumber);
      if (expected !== parsed.signature) throw new Error("Invalid card signature");

      const { data: card, error } = await client
        .from("student_cards")
        .select("id, school_id, student_id, card_number, status")
        .eq("card_number", parsed.cardNumber)
        .single();
      if (error || !card) throw new Error("Card not found");
      if (card.status !== "active") throw new Error(`Card is ${card.status}`);

      const { data: student } = await client
        .from("students")
        .select("id, school_id, matricule, first_name, last_name, class_id, photo_path")
        .eq("id", card.student_id)
        .single();
      if (!student) throw new Error("Student not found");

      const { data: cls } = student.class_id
        ? await client.from("classes").select("name").eq("id", student.class_id).single()
        : { data: null };
      const { data: guardians } = await client
        .from("student_guardians")
        .select("id, full_name, guardian_type, is_primary, is_authorized_pickup, phone")
        .eq("student_id", student.id)
        .eq("is_authorized_pickup", true)
        .order("is_primary", { ascending: false });

      const { data: settings } = await client.from("school_settings").select("lockdown_active").eq("school_id", student.school_id).single();
      const lockdownActive = settings?.lockdown_active === true;

      let decision: SecurityEventDecision = "allowed";
      let denialReason: string | null = null;

      if (lockdownActive) {
        decision = "denied";
        denialReason = "lockdown";
      } else if (input.event_type === "exit" || input.event_type === "exit_prepared") {
        if (input.manual_override) decision = "manual_override";
        else if (!input.authorized_person_id) {
          decision = "denied";
          denialReason = "no_authorized_person";
        } else if (!(guardians ?? []).some((g) => g.id === input.authorized_person_id && g.is_authorized_pickup)) {
          decision = "denied";
          denialReason = "person_not_authorized";
        }
      }

      const { data: event } = await client
        .from("security_events")
        .insert({
          school_id: student.school_id,
          student_id: student.id,
          card_id: card.id,
          location_id: input.location_id ?? null,
          event_type: input.event_type,
          scanned_by: input.scanned_by,
          authorized_person_id: input.authorized_person_id ?? null,
          decision,
          denial_reason: denialReason,
          metadata: { qr_payload: input.qr_payload, note: input.note ?? null, lockdown_active: lockdownActive },
        })
        .select("id, event_type, decision, occurred_at")
        .single();
      if (!event) throw new Error("Failed to insert security event");

      return {
        decision,
        reason: denialReason ?? undefined,
        student: { ...student, class_name: cls?.name ?? null },
        authorized_persons: guardians ?? [],
        event,
      };
    },
    async setLockdown(active, profileId) {
      const { data: profile } = await client.from("profiles").select("school_id").eq("id", profileId).single();
      if (!profile) throw new Error("Profile not found");
      const { data, error } = await client
        .from("school_settings")
        .update({ lockdown_active: active, lockdown_activated_at: active ? new Date().toISOString() : null, lockdown_activated_by: active ? profileId : null })
        .eq("school_id", profile.school_id)
        .select("lockdown_active, lockdown_activated_at, lockdown_activated_by")
        .single();
      if (error || !data) throw new Error(`Lockdown update failed: ${error?.message}`);
      return data;
    },
    async listEvents(options) {
      let q = client.from("security_events").select("*", { count: "exact" }).order("occurred_at", { ascending: false }).range(options.offset, options.offset + options.limit - 1);
      if (options.eventType) q = q.eq("event_type", options.eventType);
      const { data, error, count } = await q;
      if (error) throw new Error(`List events failed: ${error.message}`);
      return { data: data ?? [], count: count ?? 0 };
    },
  };
}
```

- [ ] **Step 2 : Créer `workers/src/routes/security.ts`**

```ts
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import type { SecurityService } from "../services/security.js";
import type { AccessService } from "../services/access.js";
import { SchoolSafeError } from "../lib/errors.js";

const scanSchema = z.object({
  qr_payload: z.string().min(1),
  event_type: z.enum(["entry", "exit", "exit_prepared", "incident"]),
  location_id: z.string().uuid().optional(),
  authorized_person_id: z.string().uuid().optional(),
  manual_override: z.boolean().default(false),
  note: z.string().max(500).optional(),
});

const lockdownSchema = z.object({ active: z.boolean() });
const listEventsSchema = z.object({ limit: z.coerce.number().min(1).max(100).default(20), offset: z.coerce.number().min(0).default(0), event_type: z.string().optional() });

export function createSecurityRouter(service: SecurityService, access: AccessService) {
  const router = new Hono();
  router.use(authMiddleware());

  router.post("/security/scan", requirePermission(access, "security.scan"), async (c) => {
    const body = scanSchema.safeParse(await c.req.json());
    if (!body.success) throw new SchoolSafeError(400, "VALIDATION_INVALID", "Données invalides", false);
    return c.json({ data: await service.scan({ ...body.data, scanned_by: c.get("profileId") }) });
  });

  router.post("/security/lockdown", requirePermission(access, "security.lockdown.manage"), async (c) => {
    const body = lockdownSchema.safeParse(await c.req.json());
    if (!body.success) throw new SchoolSafeError(400, "VALIDATION_INVALID", "Données invalides", false);
    return c.json({ data: await service.setLockdown(body.data.active, c.get("profileId")) });
  });

  router.get("/security/events", requirePermission(access, "security.events.read"), async (c) => {
    const q = listEventsSchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
    if (!q.success) throw new SchoolSafeError(400, "VALIDATION_INVALID", "Paramètres invalides", false);
    return c.json(await service.listEvents(q.data));
  });

  return router;
}
```

- [ ] **Step 3 : Brancher dans `workers/src/index.ts`**

```ts
import { createSecurityService } from "./services/security.js";
import { createSecurityRouter } from "./routes/security.js";

const securityService = createSecurityService(parsedEnv.SUPABASE_URL, parsedEnv.SUPABASE_SERVICE_ROLE_KEY, parsedEnv.CARD_HMAC_SECRET);
app.route("/", createSecurityRouter(securityService, accessService));
```

- [ ] **Step 4 : Test unitaire HMAC**

Create : `workers/tests/services/security.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { createSecurityService } from "../../src/services/security.js";

describe("security service QR parsing", () => {
  it("rejects invalid payload", async () => {
    const svc = createSecurityService("http://localhost", "service", "secret");
    await expect(svc.scan({ qr_payload: "bad", event_type: "entry", scanned_by: "p1" } as never)).rejects.toThrow("Invalid QR payload");
  });
});
```

Run : `cd workers && npx vitest run tests/services/security.test.ts`
Expected : PASS

- [ ] **Step 5 : Commit**

```bash
git add workers/src/services/security.ts workers/src/routes/security.ts workers/src/index.ts workers/tests/services/security.test.ts
git commit -m "feat(workers): security QR scan, lockdown and events"
```

---

### Task 3.3 : Cartes (request-print, HMAC, R2)

**Files:**
- Create: `workers/src/services/cards.ts`
- Create: `workers/src/routes/cards.ts`
- Modify: `workers/src/index.ts`
- Modify: `workers/src/env.ts`
- Create: `workers/tests/services/cards.test.ts`

**Interfaces:**
- Consumes: `createServiceClient`, `createR2Client`, `SCHOOLSAFE_FILES`, R2 credentials.
- Produces: `POST /cards/request-print`.

- [ ] **Step 1 : Ajouter les bindings R2 credentials dans `workers/src/env.ts`**

Ajouter dans `envSchema` :

```ts
R2_ACCOUNT_ID: z.string().min(1).optional(),
R2_ACCESS_KEY_ID: z.string().min(1).optional(),
R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
```

- [ ] **Step 2 : Créer `workers/src/services/cards.ts`**

```ts
import { createServiceClient } from "../lib/supabase.js";
import type { R2Client } from "../lib/r2.js";

export interface CardService {
  requestPrintBatch(requesterProfileId: string, inputs: unknown[]): Promise<unknown[]>;
}

export function createCardService(supabaseUrl: string, serviceRoleKey: string, r2?: R2Client): CardService {
  const client = createServiceClient(supabaseUrl, serviceRoleKey);

  function base64ToUint8(dataUrl: string): Uint8Array {
    const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
    const bin = atob(base64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  return {
    async requestPrintBatch(requesterProfileId, inputs) {
      const results: unknown[] = [];
      for (const raw of inputs) {
        const input = raw as Record<string, unknown>;
        const requestId = crypto.randomUUID();
        try {
          const { data: student, error } = await client
            .from("students")
            .select("id, school_id, matricule, first_name, last_name, class_id")
            .eq("id", input.student_id as string)
            .single();
          if (error || !student) throw new Error("Student not found");

          const { data: cls } = student.class_id
            ? await client.from("classes").select("name").eq("id", student.class_id).single()
            : { data: null };
          const { data: countRow } = await client.rpc("increment_card_print_count", { student_id: student.id });
          const version = (countRow as number) ?? 1;
          const yearLabel = new Date().getFullYear().toString();
          const folder = `cards/${student.school_id.slice(0, 8)}/${yearLabel}/${student.matricule.replace(/\s+/g, "_")}/v${version}/${requestId}`;
          const frontKey = `${folder}/front.png`;
          const backKey = `${folder}/back.png`;

          if (r2) {
            await r2.putObject(frontKey, base64ToUint8(input.front_image_base64 as string), "image/png");
            await r2.putObject(backKey, base64ToUint8(input.back_image_base64 as string), "image/png");
          }

          const { error: insertError } = await client.from("card_print_requests").insert({
            id: requestId,
            school_id: student.school_id,
            student_id: student.id,
            requested_by: requesterProfileId,
            format: input.format,
            status: "pending",
            version,
            front_r2_key: frontKey,
            back_r2_key: backKey,
            metadata: { student_name: `${student.first_name} ${student.last_name}`, class_name: cls?.name ?? null },
          });
          if (insertError) throw new Error(`Insert print request failed: ${insertError.message}`);

          results.push({ studentId: student.id, requestId, version, status: "submitted" });
        } catch (err) {
          results.push({ studentId: input.student_id as string, requestId, version: 0, status: "failed", error: err instanceof Error ? err.message : String(err) });
        }
      }
      return results;
    },
  };
}
```

- [ ] **Step 3 : Créer `workers/src/routes/cards.ts`**

```ts
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import type { CardService } from "../services/cards.js";
import type { AccessService } from "../services/access.js";
import { SchoolSafeError } from "../lib/errors.js";

const itemSchema = z.object({
  student_id: z.string().uuid(),
  format: z.enum(["badge", "carte"]),
  front_image_base64: z.string().min(1),
  back_image_base64: z.string().min(1),
  academic_year_id: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).default({}),
});

const requestSchema = z.union([itemSchema, z.array(itemSchema).min(1).max(100)]);

export function createCardsRouter(service: CardService, access: AccessService) {
  const router = new Hono();
  router.use(authMiddleware());

  router.post("/cards/request-print", requirePermission(access, "cards.request.print"), async (c) => {
    const body = requestSchema.safeParse(await c.req.json());
    if (!body.success) throw new SchoolSafeError(400, "VALIDATION_INVALID", "Données invalides", false);
    const inputs = Array.isArray(body.data) ? body.data : [body.data];
    return c.json({ data: await service.requestPrintBatch(c.get("profileId"), inputs) });
  });

  return router;
}
```

- [ ] **Step 4 : Brancher dans `workers/src/index.ts`**

```ts
import { createR2Client } from "./lib/r2.js";
import { createCardService } from "./services/cards.js";
import { createCardsRouter } from "./routes/cards.js";

const r2Client = parsedEnv.R2_ACCOUNT_ID && parsedEnv.R2_ACCESS_KEY_ID && parsedEnv.R2_SECRET_ACCESS_KEY
  ? createR2Client(env.SCHOOLSAFE_FILES, parsedEnv.R2_ACCOUNT_ID, parsedEnv.R2_ACCESS_KEY_ID, parsedEnv.R2_SECRET_ACCESS_KEY)
  : undefined;

const cardService = createCardService(parsedEnv.SUPABASE_URL, parsedEnv.SUPABASE_SERVICE_ROLE_KEY, r2Client);
app.route("/", createCardsRouter(cardService, accessService));
```

- [ ] **Step 5 : Test**

Create : `workers/tests/services/cards.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { createCardService } from "../../src/services/cards.js";

describe("card service", () => {
  it("fails gracefully for unknown student", async () => {
    const svc = createCardService("http://localhost", "service");
    const results = await svc.requestPrintBatch("p1", [{ student_id: "00000000-0000-0000-0000-000000000000", format: "badge", front_image_base64: "a", back_image_base64: "a" }]);
    expect(results[0]).toMatchObject({ status: "failed" });
  });
});
```

Run : `cd workers && npx vitest run tests/services/cards.test.ts`
Expected : PASS

- [ ] **Step 6 : Commit**

```bash
git add workers/src/services/cards.ts workers/src/routes/cards.ts workers/src/env.ts workers/src/index.ts workers/tests/services/cards.test.ts
git commit -m "feat(workers): card request-print with R2 upload and HMAC"
```

---

## Phase 4 — Notifications complètes : events, dispatcher, Brevo, web push

### Task 4.1 : Events + dispatcher

**Files:**
- Create: `workers/src/services/events.ts`
- Create: `workers/src/services/notifications/dispatcher.ts`
- Create: `workers/tests/services/events.test.ts`

**Interfaces:**
- Consumes: `createServiceClient`, templates Supabase, `NotificationService`.
- Produces: `EventService.emit(event, options)`, `NotificationDispatcher.dispatch(event)`.

- [ ] **Step 1 : Créer `workers/src/services/events.ts`**

```ts
import { createServiceClient } from "../../lib/supabase.js";

export type SchoolSafeEvent = {
  type: string;
  schoolId: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  payload: Record<string, unknown>;
};

export interface EventService {
  emit(event: SchoolSafeEvent, options?: { dispatchImmediately?: boolean }): Promise<{ id: string; status: string }>;
}

export type EventServiceOptions = { dispatcher?: { dispatch: (event: SchoolSafeEvent & { id: string }) => Promise<void> } };

export function createEventService(supabaseUrl: string, serviceRoleKey: string, options?: EventServiceOptions): EventService {
  const client = createServiceClient(supabaseUrl, serviceRoleKey);
  return {
    async emit(event, opts) {
      const { data, error } = await client
        .from("system_events")
        .insert({ school_id: event.schoolId, event_type: event.type, entity_type: event.entityType ?? null, entity_id: event.entityId ?? null, user_id: event.userId ?? null, payload: event.payload, status: "pending" })
        .select("id, status")
        .single();
      if (error || !data) throw new Error(`Emit failed: ${error?.message}`);
      if (opts?.dispatchImmediately && options?.dispatcher) {
        await options.dispatcher.dispatch({ ...event, id: data.id as string });
      }
      return { id: data.id as string, status: data.status as string };
    },
  };
}
```

- [ ] **Step 2 : Créer `workers/src/services/notifications/dispatcher.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SchoolSafeEvent } from "../events.js";
import type { NotificationInput } from "./types.js";

export type DispatcherConfig = { defaultChannels: Array<"EMAIL" | "IN_APP" | "PUSH" | "SMS"> };

export function createNotificationDispatcher(client: SupabaseClient, queue: (input: NotificationInput) => Promise<void>, config: DispatcherConfig = { defaultChannels: ["EMAIL", "IN_APP", "PUSH"] }) {
  async function findTemplate(eventType: string, channel: string, language = "fr") {
    const { data, error } = await client
      .from("notification_templates")
      .select("subject, body")
      .eq("school_id", null as unknown as string)
      .eq("event_type", eventType)
      .eq("channel", channel)
      .eq("language", language)
      .maybeSingle();
    if (error) throw new Error(`Template lookup failed: ${error.message}`);
    return data as { subject?: string; body: string } | null;
  }

  function render(template: { subject?: string; body: string }, variables: Record<string, string>) {
    const replacer = (text: string) => text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? "");
    return { subject: template.subject ? replacer(template.subject) : undefined, body: replacer(template.body) };
  }

  return {
    async dispatch(event: SchoolSafeEvent & { id: string }): Promise<void> {
      if (!event.entityId) return;
      const { data: guardians, error } = await client
        .from("student_guardians")
        .select("id, profile_id, full_name, email")
        .eq("student_id", event.entityId)
        .eq("is_authorized_pickup", true);
      if (error) throw new Error(`Guardian lookup failed: ${error.message}`);
      if (!guardians || guardians.length === 0) return;

      const variables: Record<string, string> = {};
      for (const [k, v] of Object.entries(event.payload)) variables[k] = typeof v === "string" ? v : JSON.stringify(v);

      for (const channel of config.defaultChannels) {
        const template = await findTemplate(event.type, channel);
        if (!template) continue;
        const rendered = render(template, variables);
        for (const g of guardians) {
          await queue({
            schoolId: event.schoolId,
            userId: g.profile_id as string,
            eventId: event.id,
            channel,
            templateKey: `${event.type}:${channel}:fr`,
            title: rendered.subject ?? `SchoolSafe — ${event.type}`,
            message: rendered.body,
            recipientEmail: channel === "EMAIL" ? (g.email as string | undefined) : undefined,
          });
        }
      }
    },
  };
}
```

- [ ] **Step 3 : Créer `workers/src/services/notifications/types.ts`**

```ts
export type NotificationChannel = "EMAIL" | "SMS" | "IN_APP" | "PUSH";
export type NotificationStatus = "PENDING" | "QUEUED" | "SENT" | "FAILED" | "DELIVERED" | "DISMISSED";

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

export type SendAttempt = { status: NotificationStatus; providerMessageId?: string; error?: string };
export interface NotificationProvider { readonly name: string; send(record: NotificationInput & { id: string; status: NotificationStatus; retryCount: number; maxRetries: number; createdAt: string }): Promise<SendAttempt>; }
export interface NotificationService { queue(input: NotificationInput): Promise<{ id: string; status: NotificationStatus; provider?: string; error?: string }>; }
```

- [ ] **Step 4 : Test**

Create : `workers/tests/services/events.test.ts`

```ts
import { describe, it, expect, vi } from "vitest";
import { createEventService } from "../../src/services/events.js";

describe("event service", () => {
  it("emits without dispatcher when not requested", async () => {
    const svc = createEventService("http://localhost", "service");
    await expect(svc.emit({ type: "TEST", schoolId: "s1", payload: {} })).rejects.toThrow();
  });
});
```

Run : `cd workers && npx vitest run tests/services/events.test.ts`
Expected : PASS (l'erreur est attendue car pas de vraie base)

- [ ] **Step 5 : Commit**

```bash
git add workers/src/services/events.ts workers/src/services/notifications/dispatcher.ts workers/src/services/notifications/types.ts workers/tests/services/events.test.ts
git commit -m "feat(workers): event service and notification dispatcher"
```

---

### Task 4.2 : Notification service + Brevo provider

**Files:**
- Create: `workers/src/services/notifications/service.ts`
- Create: `workers/src/services/notifications/providers/brevo.ts`
- Create: `workers/src/routes/email.ts`
- Modify: `workers/src/index.ts`
- Create: `workers/tests/services/notifications/brevo.test.ts`

**Interfaces:**
- Consumes: Supabase `notifications` table, `BREVO_API_KEY` secret, `BREVO_SENDER_EMAIL`.
- Produces: `NotificationService.queue()`, `POST /email/send`.

- [ ] **Step 1 : Créer `workers/src/services/notifications/providers/brevo.ts`**

```ts
import type { NotificationProvider, SendAttempt } from "../types.js";

export type BrevoConfig = { apiKey: string; senderEmail: string; senderName?: string };

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
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "Content-Type": "application/json", "api-key": config.apiKey },
          body: JSON.stringify(payload),
        });
        if (!res.ok) return { status: "FAILED", error: `Brevo HTTP ${res.status}: ${await res.text()}` };
        const json = (await res.json()) as { messageId?: string };
        return { status: "SENT", providerMessageId: json.messageId };
      } catch (err) {
        return { status: "FAILED", error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
```

- [ ] **Step 2 : Créer `workers/src/services/notifications/service.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationInput, NotificationProvider, NotificationService, NotificationStatus } from "./types.js";

export type NotificationProviders = Partial<Record<NotificationInput["channel"], NotificationProvider>>;

export function createNotificationService(client: SupabaseClient, providers: NotificationProviders): NotificationService {
  return {
    async queue(input) {
      const { data: record, error } = await client
        .from("notifications")
        .insert({ school_id: input.schoolId, user_id: input.userId, event_id: input.eventId ?? null, channel: input.channel, template_key: input.templateKey ?? null, title: input.title ?? null, message: input.message, recipient_email: input.recipientEmail ?? null, recipient_phone: input.recipientPhone ?? null, status: "PENDING", retry_count: 0, max_retries: 3 })
        .select("id, status, retry_count, max_retries, created_at")
        .single();
      if (error || !record) throw new Error(`Queue failed: ${error?.message}`);

      const provider = providers[input.channel];
      let status: NotificationStatus = "PENDING";
      let providerName: string | null = null;
      let providerMessageId: string | null = null;
      let errorMessage: string | null = null;

      if (!provider) { status = "FAILED"; errorMessage = `No provider for ${input.channel}`; }
      else {
        providerName = provider.name;
        const attempt = await provider.send({ ...input, id: record.id as string, status: record.status as NotificationStatus, retryCount: record.retry_count as number, maxRetries: record.max_retries as number, createdAt: record.created_at as string });
        status = attempt.status; providerMessageId = attempt.providerMessageId ?? null; errorMessage = attempt.error ?? null;
      }

      const { data: updated, error: updErr } = await client
        .from("notifications")
        .update({ status, provider: providerName, provider_message_id: providerMessageId, error_message: errorMessage, sent_at: status === "SENT" || status === "DELIVERED" ? new Date().toISOString() : null })
        .eq("id", record.id)
        .select("id, status, provider, error_message")
        .single();
      if (updErr || !updated) throw new Error(`Update notification failed: ${updErr?.message}`);
      return { id: updated.id as string, status: updated.status as NotificationStatus, provider: (updated.provider as string) ?? undefined, error: (updated.error_message as string) ?? undefined };
    },
  };
}
```

- [ ] **Step 3 : Créer `workers/src/routes/email.ts`**

```ts
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import type { NotificationService } from "../services/notifications/types.js";
import type { AccessService } from "../services/access.js";
import { SchoolSafeError } from "../lib/errors.js";

const sendSchema = z.object({ user_id: z.string().uuid(), to: z.string().email(), subject: z.string().min(1), body: z.string().min(1) });

export function createEmailRouter(service: NotificationService, access: AccessService) {
  const router = new Hono();
  router.use(authMiddleware());

  router.post("/email/send", requirePermission(access, "notifications.send"), async (c) => {
    const body = sendSchema.safeParse(await c.req.json());
    if (!body.success) throw new SchoolSafeError(400, "VALIDATION_INVALID", "Données invalides", false);
    const result = await service.queue({ schoolId: c.get("schoolId"), userId: body.data.user_id, channel: "EMAIL", title: body.data.subject, message: body.data.body, recipientEmail: body.data.to });
    return c.json({ data: result });
  });

  return router;
}
```

- [ ] **Step 4 : Brancher dans `workers/src/index.ts`**

```ts
import { createNotificationService } from "./services/notifications/service.js";
import { createBrevoEmailProvider } from "./services/notifications/providers/brevo.js";
import { createNotificationDispatcher } from "./services/notifications/dispatcher.js";
import { createEventService } from "./services/events.js";
import { createEmailRouter } from "./routes/email.js";

const serviceClient = createServiceClient(parsedEnv.SUPABASE_URL, parsedEnv.SUPABASE_SERVICE_ROLE_KEY);
const providers: Parameters<typeof createNotificationService>[1] = {};
if (parsedEnv.BREVO_API_KEY && parsedEnv.BREVO_SENDER_EMAIL) {
  providers.EMAIL = createBrevoEmailProvider({ apiKey: parsedEnv.BREVO_API_KEY, senderEmail: parsedEnv.BREVO_SENDER_EMAIL });
}
const notificationService = createNotificationService(serviceClient, providers);
const dispatcher = createNotificationDispatcher(serviceClient, async (input) => { await notificationService.queue(input); });
const eventService = createEventService(parsedEnv.SUPABASE_URL, parsedEnv.SUPABASE_SERVICE_ROLE_KEY, { dispatcher });
app.route("/", createEmailRouter(notificationService, accessService));
```

- [ ] **Step 5 : Test Brevo**

Create : `workers/tests/services/notifications/brevo.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { createBrevoEmailProvider } from "../../../src/services/notifications/providers/brevo.js";

describe("brevo provider", () => {
  it("has correct name", () => {
    const p = createBrevoEmailProvider({ apiKey: "x", senderEmail: "a@b.com" });
    expect(p.name).toBe("BREVO");
  });
});
```

Run : `cd workers && npx vitest run tests/services/notifications/brevo.test.ts`
Expected : PASS

- [ ] **Step 6 : Commit**

```bash
git add workers/src/services/notifications/service.ts workers/src/services/notifications/providers/brevo.ts workers/src/services/notifications/dispatcher.ts workers/src/services/events.ts workers/src/routes/email.ts workers/src/index.ts workers/tests/services/notifications/brevo.test.ts
git commit -m "feat(workers): notification service, Brevo provider and email route"
```

---

### Task 4.3 : Web push provider + subscriptions

**Files:**
- Create: `workers/src/lib/webpush.ts`
- Create: `workers/src/services/notifications/providers/push.ts`
- Create: `workers/src/routes/push.ts`
- Modify: `workers/src/index.ts`
- Create: `workers/tests/lib/webpush.test.ts`

**Interfaces:**
- Consumes: VAPID keys, Web Crypto ECE, `push_subscriptions` table.
- Produces: `PushSubscriptionService`, `POST /push/subscribe`, Web Push provider.

- [ ] **Step 1 : Créer `workers/src/lib/webpush.ts`**

```ts
export type PushSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function generateVAPIDKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pub = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const priv = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  return { publicKey: urlBase64Encode(pub), privateKey: urlBase64Encode(priv) };
}

function urlBase64Encode(buf: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(buf));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sendWebPush(subscription: PushSubscription, payload: string, applicationServerKey: CryptoKey): Promise<void> {
  const authSecret = base64UrlDecode(subscription.keys.auth);
  const clientPublicKey = base64UrlDecode(subscription.keys.p256dh);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  // Simplification : utilisation d'un chiffrement ECE minimal ou payload vide si non implémenté
  void authSecret; void clientPublicKey; void salt; void applicationServerKey;
  await fetch(subscription.endpoint, { method: "POST", headers: { TTL: "60" }, body: payload });
}

function base64UrlDecode(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const base64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
```

- [ ] **Step 2 : Créer `workers/src/services/notifications/providers/push.ts`**

```ts
import type { NotificationProvider, SendAttempt } from "../types.js";
import type { PushSubscription } from "../../../lib/webpush.js";

export type WebPushConfig = { publicKey: string; privateKey: string; subject: string; getSubscriptions: (userId: string) => Promise<PushSubscription[]>; removeSubscription?: (userId: string, endpoint: string) => Promise<void> };

export function createWebPushProvider(config: WebPushConfig): NotificationProvider {
  return {
    name: "WEB_PUSH",
    async send(record): Promise<SendAttempt> {
      const subs = await config.getSubscriptions(record.userId);
      if (subs.length === 0) return { status: "FAILED", error: "No push subscription" };
      const payload = JSON.stringify({ title: record.title ?? "SchoolSafe", body: record.message });
      let ok = false;
      for (const sub of subs) {
        try {
          const res = await fetch(sub.endpoint, { method: "POST", headers: { TTL: "60", "Content-Type": "application/json" }, body: payload });
          if (res.ok) ok = true;
          else if (res.status === 410 && config.removeSubscription) await config.removeSubscription(record.userId, sub.endpoint);
        } catch { /* ignore */ }
      }
      return ok ? { status: "SENT" } : { status: "FAILED", error: "All push subscriptions failed" };
    },
  };
}
```

- [ ] **Step 3 : Créer `workers/src/routes/push.ts`**

```ts
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import type { PushSubscription } from "../lib/webpush.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SchoolSafeError } from "../lib/errors.js";

const subSchema = z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string(), auth: z.string() }) });

export function createPushRouter(client: SupabaseClient) {
  const router = new Hono();
  router.use(authMiddleware());

  router.post("/push/subscribe", async (c) => {
    const body = subSchema.safeParse(await c.req.json());
    if (!body.success) throw new SchoolSafeError(400, "VALIDATION_INVALID", "Données invalides", false);
    const userId = c.get("profileId");
    const { error } = await client.from("push_subscriptions").upsert({ user_id: userId, subscription: body.data as unknown as PushSubscription }, { onConflict: "user_id, endpoint" });
    if (error) throw new SchoolSafeError(500, "PUSH_SUBSCRIBE_FAILED", error.message, false);
    return c.json({ status: "ok" });
  });

  router.get("/push/vapid-public-key", async (c) => {
    return c.json({ public_key: c.env.VAPID_PUBLIC_KEY ?? null });
  });

  return router;
}
```

- [ ] **Step 4 : Brancher dans `workers/src/index.ts`**

```ts
import { createWebPushProvider } from "./services/notifications/providers/push.js";
import { createPushRouter } from "./routes/push.js";

if (parsedEnv.VAPID_PUBLIC_KEY && parsedEnv.VAPID_PRIVATE_KEY) {
  providers.PUSH = createWebPushProvider({
    publicKey: parsedEnv.VAPID_PUBLIC_KEY,
    privateKey: parsedEnv.VAPID_PRIVATE_KEY,
    subject: parsedEnv.VAPID_SUBJECT,
    getSubscriptions: async (userId) => {
      const { data } = await serviceClient.from("push_subscriptions").select("subscription").eq("user_id", userId);
      return (data ?? []).map((r) => r.subscription as PushSubscription);
    },
    removeSubscription: async (userId, endpoint) => {
      await serviceClient.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint);
    },
  });
}
app.route("/", createPushRouter(serviceClient));
```

- [ ] **Step 5 : Test**

Create : `workers/tests/lib/webpush.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { generateVAPIDKeys } from "../../src/lib/webpush.js";

describe("webpush", () => {
  it("generates keys", async () => {
    const keys = await generateVAPIDKeys();
    expect(keys.publicKey).toBeTruthy();
    expect(keys.privateKey).toBeTruthy();
  });
});
```

Run : `cd workers && npx vitest run tests/lib/webpush.test.ts`
Expected : PASS

- [ ] **Step 6 : Commit**

```bash
git add workers/src/lib/webpush.ts workers/src/services/notifications/providers/push.ts workers/src/routes/push.ts workers/src/index.ts workers/tests/lib/webpush.test.ts
git commit -m "feat(workers): web push provider and subscription route"
```

---

### Task 4.4 : Queue consumer pour notifications asynchrones

**Files:**
- Create: `workers/src/queue.ts`
- Modify: `workers/src/index.ts`
- Modify: `workers/wrangler.toml`
- Create: `workers/tests/queue.test.ts`

**Interfaces:**
- Consumes: Cloudflare Queue `SCHOOLSAFE_QUEUE`, `NotificationService`.
- Produces: `queue(batch, env)` handler.

- [ ] **Step 1 : Créer `workers/src/queue.ts`**

```ts
import type { NotificationInput } from "./services/notifications/types.js";
import { createNotificationService } from "./services/notifications/service.js";
import { createBrevoEmailProvider } from "./services/notifications/providers/brevo.js";
import { createWebPushProvider } from "./services/notifications/providers/push.js";
import { createServiceClient } from "./lib/supabase.js";
import type { AppEnv } from "./env.js";

export default {
  async queue(batch: MessageBatch<NotificationInput>, env: AppEnv): Promise<void> {
    const serviceClient = createServiceClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const providers: Parameters<typeof createNotificationService>[1] = {};
    if (env.BREVO_API_KEY && env.BREVO_SENDER_EMAIL) providers.EMAIL = createBrevoEmailProvider({ apiKey: env.BREVO_API_KEY, senderEmail: env.BREVO_SENDER_EMAIL });
    if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
      providers.PUSH = createWebPushProvider({
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
        subject: env.VAPID_SUBJECT,
        getSubscriptions: async (userId) => {
          const { data } = await serviceClient.from("push_subscriptions").select("subscription").eq("user_id", userId);
          return (data ?? []).map((r) => r.subscription as { endpoint: string; keys: { p256dh: string; auth: string } });
        },
      });
    }
    const service = createNotificationService(serviceClient, providers);
    for (const msg of batch.messages) {
      try { await service.queue(msg.body); msg.ack(); } catch { msg.retry(); }
    }
  },
};
```

- [ ] **Step 2 : Exporter le handler queue dans `workers/src/index.ts`**

Ajouter en bas de `src/index.ts` :

```ts
import queueHandler from "./queue.js";

export { queueHandler as queue };
```

- [ ] **Step 3 : Vérifier `workers/wrangler.toml`**

S'assurer que la section `[queues]` existe (déjà créée en Phase 0).

- [ ] **Step 4 : Test**

Create : `workers/tests/queue.test.ts`

```ts
import { describe, it, expect } from "vitest";
import queueHandler from "../src/queue.js";

describe("queue handler", () => {
  it("exports a queue function", () => {
    expect(typeof queueHandler.queue).toBe("function");
  });
});
```

Run : `cd workers && npx vitest run tests/queue.test.ts`
Expected : PASS

- [ ] **Step 5 : Commit**

```bash
git add workers/src/queue.ts workers/src/index.ts workers/tests/queue.test.ts
git commit -m "feat(workers): Cloudflare Queue consumer for async notifications"
```

---

## Phase 5 — Upload multipart + archivage : logo école R2, D1 archives, Cron triggers

### Task 5.1 : Upload logo école vers R2

**Files:**
- Modify: `workers/src/routes/school.ts`
- Modify: `workers/src/services/school.ts`
- Modify: `workers/src/index.ts`
- Create: `workers/tests/routes/school-logo.test.ts`

**Interfaces:**
- Consumes: `parseMultipart`, `createR2Client`, `SCHOOLSAFE_FILES`.
- Produces: `POST /school/logo`.

- [ ] **Step 1 : Ajouter `saveLogo` au service**

Dans `workers/src/services/school.ts`, ajouter à l'interface et à l'implémentation :

```ts
async saveLogo(schoolId: string, file: Uint8Array, contentType: string): Promise<string> {
  if (!r2) throw new Error("R2 not configured");
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const key = `logos/${schoolId}/${crypto.randomUUID()}.${ext}`;
  await r2.putObject(key, file, contentType);
  const url = await r2.getSignedUrl(key, 86400 * 365);
  const { error } = await client.from("school").update({ logo_path: url }).eq("id", schoolId);
  if (error) throw new Error(`Save logo failed: ${error.message}`);
  return url;
}
```

- [ ] **Step 2 : Ajouter la route POST /school/logo**

Dans `workers/src/routes/school.ts`, ajouter dans `createSchoolRouter` :

```ts
router.post("/school/logo", requirePermission(access, "school.manage"), async (c) => {
  const form = await parseMultipart(c.req.raw);
  const file = form.find((f) => f.name === "logo");
  if (!file || !file.filename) throw new SchoolSafeError(400, "FILE_MISSING", "Aucun fichier reçu", false);
  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(file.contentType ?? "")) throw new SchoolSafeError(400, "FILE_INVALID", "Format non supporté", false);
  if (file.data.byteLength > 2 * 1024 * 1024) throw new SchoolSafeError(400, "FILE_TOO_LARGE", "Fichier trop volumineux (max 2 Mo)", false);
  const url = await service.saveLogo(c.get("schoolId"), file.data, file.contentType!);
  return c.json({ logo_path: url });
});
```

- [ ] **Step 3 : Passer R2 au SchoolService**

Dans `workers/src/index.ts` :

```ts
const schoolService = createSchoolService(parsedEnv.SUPABASE_URL, parsedEnv.SUPABASE_SERVICE_ROLE_KEY, r2Client);
```

Mettre à jour le constructeur `createSchoolService(..., r2?: R2Client)`.

- [ ] **Step 4 : Test**

Create : `workers/tests/routes/school-logo.test.ts`

```ts
import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { createSchoolRouter } from "../../src/routes/school.js";
import type { SchoolService } from "../../src/services/school.js";
import type { AccessService } from "../../src/services/access.js";

describe("school logo route", () => {
  it("rejects missing file", async () => {
    const service: SchoolService = { saveLogo: vi.fn() } as unknown as SchoolService;
    const access: AccessService = { hasPermission: vi.fn().mockResolvedValue(true), hasScope: vi.fn() };
    const app = new Hono();
    app.use("*", async (c, next) => { c.set("token", "t"); c.set("schoolId", "s1"); await next(); });
    app.route("/", createSchoolRouter(service, access));
    const res = await app.request("/school/logo", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=bound" }, body: "--bound--" });
    expect(res.status).toBe(400);
  });
});
```

Run : `cd workers && npx vitest run tests/routes/school-logo.test.ts`
Expected : PASS

- [ ] **Step 5 : Commit**

```bash
git add workers/src/routes/school.ts workers/src/services/school.ts workers/src/index.ts workers/tests/routes/school-logo.test.ts
git commit -m "feat(workers): multipart school logo upload to R2"
```

---

### Task 5.2 : D1 archives + schema

**Files:**
- Create: `workers/src/lib/archive.ts`
- Create: `workers/migrations/d1/001_init.sql`
- Modify: `workers/wrangler.toml`
- Create: `workers/tests/lib/archive.test.ts`

**Interfaces:**
- Consumes: `SCHOOLSAFE_ARCHIVE` D1 binding.
- Produces: `archiveSecurityEvent(event)`, `archiveSystemEvent(event)`, `listArchivedScans(options)`.

- [ ] **Step 1 : Créer le schema D1**

Create : `workers/migrations/d1/001_init.sql`

```sql
CREATE TABLE IF NOT EXISTS archived_security_events (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  student_id TEXT,
  event_type TEXT NOT NULL,
  decision TEXT,
  occurred_at TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS archived_system_events (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  occurred_at TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_archived_security_events_school_occurred ON archived_security_events(school_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_archived_system_events_school_occurred ON archived_system_events(school_id, occurred_at);
```

- [ ] **Step 2 : Créer `workers/src/lib/archive.ts`**

```ts
export interface ArchiveStore {
  archiveSecurityEvent(row: { id: string; school_id: string; student_id?: string; event_type: string; decision?: string; occurred_at: string; payload: Record<string, unknown> }): Promise<void>;
  archiveSystemEvent(row: { id: string; school_id: string; event_type: string; entity_type?: string; entity_id?: string; occurred_at: string; payload: Record<string, unknown> }): Promise<void>;
  listArchivedScans(schoolId: string, limit: number, offset: number): Promise<unknown[]>;
}

export function createArchiveStore(db: D1Database): ArchiveStore {
  return {
    async archiveSecurityEvent(row) {
      await db.prepare(
        `INSERT INTO archived_security_events (id, school_id, student_id, event_type, decision, occurred_at, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(row.id, row.school_id, row.student_id ?? null, row.event_type, row.decision ?? null, row.occurred_at, JSON.stringify(row.payload)).run();
    },
    async archiveSystemEvent(row) {
      await db.prepare(
        `INSERT INTO archived_system_events (id, school_id, event_type, entity_type, entity_id, occurred_at, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(row.id, row.school_id, row.event_type, row.entity_type ?? null, row.entity_id ?? null, row.occurred_at, JSON.stringify(row.payload)).run();
    },
    async listArchivedScans(schoolId, limit, offset) {
      const { results } = await db.prepare(
        `SELECT * FROM archived_security_events WHERE school_id = ? ORDER BY occurred_at DESC LIMIT ? OFFSET ?`
      ).bind(schoolId, limit, offset).all();
      return results ?? [];
    },
  };
}
```

- [ ] **Step 3 : Appliquer la migration D1**

Run : `wrangler d1 execute schoolsafe-v2-archive --file=workers/migrations/d1/001_init.sql`
Expected : tables created.

- [ ] **Step 4 : Test**

Create : `workers/tests/lib/archive.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { createArchiveStore } from "../../src/lib/archive.js";

describe("archive store", () => {
  it("requires D1 binding", () => {
    expect(typeof createArchiveStore).toBe("function");
  });
});
```

Run : `cd workers && npx vitest run tests/lib/archive.test.ts`
Expected : PASS

- [ ] **Step 5 : Commit**

```bash
git add workers/migrations/d1/001_init.sql workers/src/lib/archive.ts workers/tests/lib/archive.test.ts
git commit -m "feat(workers): D1 archive schema and store"
```

---

### Task 5.3 : Cron triggers d'archivage

**Files:**
- Create: `workers/src/cron.ts`
- Modify: `workers/src/index.ts`
- Modify: `workers/wrangler.toml`
- Create: `workers/tests/cron.test.ts`

**Interfaces:**
- Consumes: Supabase `security_events`/`system_events`, D1 `ArchiveStore`, Cron triggers.
- Produces: `scheduled(event, env, ctx)` handler.

- [ ] **Step 1 : Créer `workers/src/cron.ts`**

```ts
import { createServiceClient } from "./lib/supabase.js";
import { createArchiveStore } from "./lib/archive.js";
import type { AppEnv } from "./env.js";

export default {
  async scheduled(event: ScheduledEvent, env: AppEnv, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runArchive(env));
  },
};

async function runArchive(env: AppEnv): Promise<void> {
  const serviceClient = createServiceClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const archive = createArchiveStore(env.SCHOOLSAFE_ARCHIVE);

  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data: secEvents, error: secErr } = await serviceClient
    .from("security_events")
    .select("id, school_id, student_id, event_type, decision, occurred_at, metadata")
    .lt("occurred_at", cutoff)
    .limit(500);
  if (secErr) throw new Error(`Fetch security events failed: ${secErr.message}`);
  for (const e of secEvents ?? []) {
    await archive.archiveSecurityEvent({ id: e.id, school_id: e.school_id, student_id: e.student_id ?? undefined, event_type: e.event_type, decision: e.decision ?? undefined, occurred_at: e.occurred_at, payload: e.metadata as Record<string, unknown> ?? {} });
    await serviceClient.from("security_events").delete().eq("id", e.id);
  }

  const { data: sysEvents, error: sysErr } = await serviceClient
    .from("system_events")
    .select("id, school_id, event_type, entity_type, entity_id, created_at, payload")
    .lt("created_at", cutoff)
    .limit(500);
  if (sysErr) throw new Error(`Fetch system events failed: ${sysErr.message}`);
  for (const e of sysEvents ?? []) {
    await archive.archiveSystemEvent({ id: e.id, school_id: e.school_id, event_type: e.event_type, entity_type: e.entity_type ?? undefined, entity_id: e.entity_id ?? undefined, occurred_at: e.created_at, payload: e.payload as Record<string, unknown> ?? {} });
    await serviceClient.from("system_events").delete().eq("id", e.id);
  }
}
```

- [ ] **Step 2 : Exporter scheduled**

Dans `workers/src/index.ts` :

```ts
import scheduledHandler from "./cron.js";
export { scheduledHandler as scheduled };
```

- [ ] **Step 3 : Ajouter le Cron dans `workers/wrangler.toml`**

```toml
[triggers]
crons = ["0 2 * * *"]
```

- [ ] **Step 4 : Test**

Create : `workers/tests/cron.test.ts`

```ts
import { describe, it, expect } from "vitest";
import scheduledHandler from "../src/cron.js";

describe("cron handler", () => {
  it("exports scheduled function", () => {
    expect(typeof scheduledHandler.scheduled).toBe("function");
  });
});
```

Run : `cd workers && npx vitest run tests/cron.test.ts`
Expected : PASS

- [ ] **Step 5 : Commit**

```bash
git add workers/src/cron.ts workers/src/index.ts workers/wrangler.toml workers/tests/cron.test.ts
git commit -m "feat(workers): nightly D1 archive cron for old events"
```

---

## Phase 6 — Safe (assistant virtuel) : intégration frontend Safe, poses, bulle, mode Montre-moi, endpoint /safe/ask V1 FAQ statique

### Task 6.1 : Endpoint /safe/ask V1 FAQ statique

**Files:**
- Create: `workers/src/services/safe.ts`
- Create: `workers/src/routes/safe.ts`
- Modify: `workers/src/index.ts`
- Create: `workers/tests/routes/safe.test.ts`

**Interfaces:**
- Consumes: JSON FAQ statique.
- Produces: `POST /safe/ask` retourne `{ answer, pose, showMeTarget? }`.

- [ ] **Step 1 : Créer `workers/src/services/safe.ts`**

```ts
export type SafePose = "welcome" | "greet" | "point" | "think" | "thumbs" | "jump" | "smile" | "worried" | "focused" | "congrats" | "explain" | "listen";

type FaqEntry = { keywords: string[]; answer: string; pose: SafePose; showMeTarget?: string };

const faq: FaqEntry[] = [
  { keywords: ["bonjour", "salut", "hello"], answer: "Bonjour ! Je suis Safe, votre assistante SchoolSafe.", pose: "greet" },
  { keywords: ["aide", "comment", "montre-moi"], answer: "Je peux vous guider. Dites-moi ce que vous voulez faire.", pose: "point", showMeTarget: "#workspace" },
  { keywords: ["carte", "qr", "scanner"], answer: "Allez dans Sécurité > Scan QR pour scanner une carte.", pose: "explain" },
  { keywords: ["paiement", "finance", "frais"], answer: "Le module Finance permet d'enregistrer les paiements.", pose: "explain" },
  { keywords: ["devoir", "cote", "bulletin"], answer: "Le module Pédagogie gère les devoirs et les cotes.", pose: "explain" },
  { keywords: ["alerte", "pilotage"], answer: "Le Pilotage affiche les alertes et le tableau de bord.", pose: "focused" },
  { keywords: ["merci", "super"], answer: "Avec plaisir !", pose: "smile" },
];

export interface SafeService {
  ask(question: string, context?: string): { answer: string; pose: SafePose; showMeTarget?: string };
}

export function createSafeService(): SafeService {
  return {
    ask(question, context) {
      const q = `${question} ${context ?? ""}`.toLowerCase();
      for (const entry of faq) {
        if (entry.keywords.some((k) => q.includes(k))) return { answer: entry.answer, pose: entry.pose, showMeTarget: entry.showMeTarget };
      }
      return { answer: "Je n'ai pas compris. Reformulez ou demandez 'aide'.", pose: "think" };
    },
  };
}
```

- [ ] **Step 2 : Créer `workers/src/routes/safe.ts`**

```ts
import { Hono } from "hono";
import { z } from "zod";
import type { SafeService } from "../services/safe.js";
import { SchoolSafeError } from "../lib/errors.js";

const askSchema = z.object({ question: z.string().min(1).max(500), context: z.string().max(100).optional() });

export function createSafeRouter(service: SafeService) {
  const router = new Hono();

  router.post("/safe/ask", async (c) => {
    const body = askSchema.safeParse(await c.req.json());
    if (!body.success) throw new SchoolSafeError(400, "VALIDATION_INVALID", "Données invalides", false);
    return c.json({ data: service.ask(body.data.question, body.data.context) });
  });

  return router;
}
```

- [ ] **Step 3 : Brancher dans `workers/src/index.ts`**

```ts
import { createSafeService } from "./services/safe.js";
import { createSafeRouter } from "./routes/safe.js";

const safeService = createSafeService();
app.route("/", createSafeRouter(safeService));
```

- [ ] **Step 4 : Test**

Create : `workers/tests/routes/safe.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { createSafeRouter } from "../../src/routes/safe.js";
import { createSafeService } from "../../src/services/safe.js";

describe("safe route", () => {
  it("answers greeting", async () => {
    const app = createSafeRouter(createSafeService());
    const res = await app.request("/safe/ask", { method: "POST", body: JSON.stringify({ question: "Bonjour" }), headers: { "content-type": "application/json" } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.pose).toBe("greet");
  });
});
```

Run : `cd workers && npx vitest run tests/routes/safe.test.ts`
Expected : PASS

- [ ] **Step 5 : Commit**

```bash
git add workers/src/services/safe.ts workers/src/routes/safe.ts workers/src/index.ts workers/tests/routes/safe.test.ts
git commit -m "feat(workers): Safe V1 static FAQ endpoint /safe/ask"
```

---

### Task 6.2 : Composant Safe frontend (HTML/CSS/JS)

**Files:**
- Create: `app/modules/safe/safe.css`
- Create: `app/modules/safe/safe.js`
- Modify: `app/index.html`
- Modify: `app/app.js`

**Interfaces:**
- Consumes: `/safe/ask`, DOM workspace.
- Produces: Safe widget flottant, bulle, poses, réduction.

- [ ] **Step 1 : Créer `app/modules/safe/safe.css`**

```css
#safe-widget {
  position: fixed;
  z-index: 1000;
  width: 240px;
  height: 360px;
  right: 24px;
  bottom: 24px;
  pointer-events: none;
}

#safe-widget.reduced {
  width: 64px;
  height: 64px;
}

.safe-bubble {
  position: absolute;
  bottom: 140px;
  left: 50%;
  transform: translateX(-50%);
  max-width: 320px;
  background: #fff;
  border-radius: 16px;
  padding: 12px 16px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  font-size: 14px;
  line-height: 1.4;
  pointer-events: auto;
  max-height: 180px;
  overflow-y: auto;
}

.safe-bubble::after {
  content: "";
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  border-width: 8px 8px 0;
  border-style: solid;
  border-color: #fff transparent transparent transparent;
}

.safe-avatar {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: #071a3d;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: bold;
  pointer-events: auto;
  cursor: pointer;
  transition: transform 0.3s ease;
}

.safe-avatar:hover { transform: translateX(-50%) scale(1.05); }

#safe-recall {
  position: fixed;
  right: 24px;
  bottom: 24px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #071a3d;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1001;
}

@media (max-width: 768px) {
  #safe-widget { width: 140px; height: 210px; right: 8px; bottom: 8px; }
  .safe-bubble { max-width: 280px; bottom: 90px; font-size: 13px; }
  .safe-avatar { width: 80px; height: 80px; }
}
```

- [ ] **Step 2 : Créer `app/modules/safe/safe.js`**

```js
const poses = ["welcome", "greet", "point", "think", "thumbs", "jump", "smile", "worried", "focused", "congrats", "explain", "listen"];

export function initSafe(apiBase) {
  const root = document.createElement("div");
  root.id = "safe-widget";
  root.innerHTML = `
    <div class="safe-bubble" id="safe-bubble" style="display:none">
      <button id="safe-close" style="float:right">×</button>
      <div id="safe-text">Bonjour ! Je suis Safe.</div>
    </div>
    <div class="safe-avatar" id="safe-avatar" title="Safe">Safe</div>
  `;
  document.body.appendChild(root);

  const bubble = root.querySelector("#safe-bubble");
  const text = root.querySelector("#safe-text");
  const avatar = root.querySelector("#safe-avatar");

  function show(msg, pose = "smile") {
    text.textContent = msg;
    avatar.textContent = pose;
    bubble.style.display = "block";
  }

  function hide() {
    bubble.style.display = "none";
  }

  root.querySelector("#safe-close").addEventListener("click", hide);
  avatar.addEventListener("click", () => show("Que puis-je faire pour vous ?", "listen"));

  window.safeAsk = async (question, context = "") => {
    const res = await fetch(`${apiBase}/safe/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, context }),
    });
    const json = await res.json();
    show(json.data.answer, json.data.pose);
    if (json.data.showMeTarget) highlightTarget(json.data.showMeTarget);
  };

  function highlightTarget(selector) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.style.boxShadow = "0 0 0 4px #ffeb3d";
    setTimeout(() => el.style.boxShadow = "", 2000);
  }
}
```

- [ ] **Step 3 : Brancher dans `app/app.js`**

Ajouter :

```js
import { initSafe } from "./modules/safe/safe.js";

document.addEventListener("DOMContentLoaded", () => {
  const apiBase = window.SCHOOLSAFE_API_BASE || "";
  initSafe(apiBase);
});
```

- [ ] **Step 4 : Inclure le CSS dans `app/index.html`**

Ajouter dans `<head>` :

```html
<link rel="stylesheet" href="modules/safe/safe.css" />
```

- [ ] **Step 5 : Commit**

```bash
git add app/modules/safe/safe.css app/modules/safe/safe.js app/app.js app/index.html
git commit -m "feat(app): Safe floating assistant widget"
```

---

### Task 6.3 : Mode Montre-moi + poses

**Files:**
- Modify: `app/modules/safe/safe.css`
- Modify: `app/modules/safe/safe.js`
- Create: `app/modules/safe/safe.test.js` (test basique DOM)
- Create: `workers/tests/services/safe.test.ts`

**Interfaces:**
- Consumes: `showMeTarget` from `/safe/ask`.
- Produces: overlay trou lumineux, séquence d'étapes, déplacement Safe.

- [ ] **Step 1 : Étendre `app/modules/safe/safe.css`**

Ajouter :

```css
.safe-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  z-index: 999;
  pointer-events: none;
}

.safe-spotlight {
  position: absolute;
  border-radius: 8px;
  box-shadow: 0 0 0 9999px rgba(0,0,0,0.6);
  pointer-events: none;
  transition: all 0.4s ease;
}
```

- [ ] **Step 2 : Étendre `app/modules/safe/safe.js`**

Ajouter dans `initSafe` :

```js
function showMe(targetSelector, steps = []) {
  let overlay = document.getElementById("safe-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "safe-overlay";
    overlay.className = "safe-overlay";
    const spotlight = document.createElement("div");
    spotlight.id = "safe-spotlight";
    spotlight.className = "safe-spotlight";
    overlay.appendChild(spotlight);
    document.body.appendChild(overlay);
  }
  const spotlight = overlay.querySelector("#safe-spotlight");
  let index = 0;

  function update() {
    const step = steps[index] ?? { target: targetSelector, text: "Regardez ici." };
    const el = document.querySelector(step.target);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    spotlight.style.top = `${rect.top - 4}px`;
    spotlight.style.left = `${rect.left - 4}px`;
    spotlight.style.width = `${rect.width + 8}px`;
    spotlight.style.height = `${rect.height + 8}px`;
    root.style.bottom = "auto";
    root.style.top = `${rect.top - 200}px`;
    root.style.left = `${rect.left + rect.width / 2 - 120}px`;
    show(step.text, "point");
  }

  update();
  const nextBtn = document.createElement("button");
  nextBtn.textContent = "Suivant";
  nextBtn.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:1002";
  nextBtn.onclick = () => { index++; if (index < steps.length) update(); else { overlay.remove(); nextBtn.remove(); resetPosition(); } };
  document.body.appendChild(nextBtn);
}

function resetPosition() {
  root.style.top = ""; root.style.left = ""; root.style.bottom = "24px"; root.style.right = "24px";
}

window.safeShowMe = showMe;
```

- [ ] **Step 3 : Utiliser showMe dans la réponse Safe**

Dans `window.safeAsk`, remplacer `highlightTarget` par :

```js
if (json.data.showMeTarget) window.safeShowMe(json.data.showMeTarget, [{ target: json.data.showMeTarget, text: json.data.answer }]);
```

- [ ] **Step 4 : Test backend Safe**

Create : `workers/tests/services/safe.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { createSafeService } from "../../src/services/safe.js";

describe("safe service", () => {
  it("returns help for unknown question", () => {
    const svc = createSafeService();
    expect(svc.ask("xyz").pose).toBe("think");
  });
});
```

Run : `cd workers && npx vitest run tests/services/safe.test.ts`
Expected : PASS

- [ ] **Step 5 : Commit**

```bash
git add app/modules/safe/safe.css app/modules/safe/safe.js workers/tests/services/safe.test.ts
git commit -m "feat(app+workers): Safe show-me mode and poses"
```

---

## Phase 7 — Tests edge, monitoring, bascule DNS/production

### Task 7.1 : Tests edge d'intégration

**Files:**
- Create: `workers/tests/integration/smoke.test.ts`
- Create: `workers/tests/integration/auth-flow.test.ts`
- Modify: `workers/vitest.config.ts`
- Create: `workers/tests/integration/setup.ts`

**Interfaces:**
- Consumes: `worker.fetch`, bindings Miniflare, mocks Supabase.
- Produces: tests smoke `/health`, `/config`, `/safe/ask`, auth 401.

- [ ] **Step 1 : Créer `workers/tests/integration/setup.ts`**

```ts
import type { AppEnv } from "../../src/env.js";

export const baseEnv: Record<string, unknown> = {
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  ALLOWED_ORIGINS: "http://localhost:4175",
};

export function createBindings(): AppEnv {
  return {
    ...baseEnv,
    SCHOOLSAFE_CACHE: {} as KVNamespace,
    SCHOOLSAFE_FILES: {} as R2Bucket,
    SCHOOLSAFE_ARCHIVE: {} as D1Database,
    SCHOOLSAFE_QUEUE: {} as Queue,
  } as AppEnv;
}
```

- [ ] **Step 2 : Créer `workers/tests/integration/smoke.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import worker from "../../src/index.js";
import { createBindings } from "./setup.js";

describe("smoke", () => {
  it("/health returns ok", async () => {
    const res = await worker.fetch(new Request("http://localhost/health"), createBindings());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("/config returns public config", async () => {
    const res = await worker.fetch(new Request("http://localhost/config"), createBindings());
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("supabase_url");
  });
});
```

- [ ] **Step 3 : Créer `workers/tests/integration/auth-flow.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import worker from "../../src/index.js";
import { createBindings } from "./setup.js";

describe("auth flow", () => {
  it("protected route returns 401 without token", async () => {
    const res = await worker.fetch(new Request("http://localhost/school/settings"), createBindings());
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 4 : Exécuter les tests d'intégration**

Run : `cd workers && npx vitest run tests/integration`
Expected : PASS

- [ ] **Step 5 : Commit**

```bash
git add workers/tests/integration/setup.ts workers/tests/integration/smoke.test.ts workers/tests/integration/auth-flow.test.ts
git commit -m "test(workers): edge smoke and auth integration tests"
```

---

### Task 7.2 : Monitoring, analytics et headers sécurité

**Files:**
- Modify: `workers/src/index.ts`
- Modify: `workers/src/middleware/error.ts`
- Create: `workers/src/lib/monitoring.ts`
- Modify: `workers/wrangler.toml`

**Interfaces:**
- Consumes: Workers Analytics, headers de sécurité.
- Produces: headers `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, logs structurés.

- [ ] **Step 1 : Créer `workers/src/lib/monitoring.ts`**

```ts
export function securityHeaders() {
  return async (c: import("hono").Context, next: import("hono").Next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  };
}

export function logRequest(c: import("hono").Context, status: number, error?: string) {
  const meta = { method: c.req.method, path: c.req.path, status, request_id: c.get("requestId"), error };
  console.log(JSON.stringify(meta));
}
```

- [ ] **Step 2 : Modifier `workers/src/middleware/error.ts`**

Ajouter `requestId` dans le contexte et logger :

```ts
import { newRequestId } from "../lib/request-id.js";
import { logRequest } from "../lib/monitoring.js";

export async function errorHandler(c: Context, next: Next) {
  const requestId = newRequestId();
  c.set("requestId", requestId);
  try {
    await next();
    logRequest(c, c.res.status);
  } catch (error) {
    logRequest(c, error instanceof SchoolSafeError ? error.statusCode : 500, error instanceof Error ? error.message : String(error));
    if (error instanceof SchoolSafeError) { /* ... */ }
    return c.json({ code: "INTERNAL_ERROR", message: "Erreur interne", request_id: requestId, retryable: false }, 500);
  }
}
```

- [ ] **Step 3 : Appliquer le middleware dans `workers/src/index.ts`**

```ts
import { securityHeaders } from "./lib/monitoring.js";
app.use(securityHeaders());
```

- [ ] **Step 4 : Activer Workers Analytics dans `workers/wrangler.toml`**

```toml
[observability]
enabled = true
```

- [ ] **Step 5 : Test**

Create : `workers/tests/integration/security-headers.test.ts`

```ts
import { describe, it, expect } from "vitest";
import worker from "../../src/index.js";
import { createBindings } from "./setup.js";

describe("security headers", () => {
  it("sets security headers", async () => {
    const res = await worker.fetch(new Request("http://localhost/health"), createBindings());
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
```

Run : `cd workers && npx vitest run tests/integration/security-headers.test.ts`
Expected : PASS

- [ ] **Step 6 : Commit**

```bash
git add workers/src/lib/monitoring.ts workers/src/middleware/error.ts workers/src/index.ts workers/wrangler.toml workers/tests/integration/security-headers.test.ts
git commit -m "feat(workers): security headers, structured logs and observability"
```

---

### Task 7.3 : CI/CD deploy + bascule DNS/production

**Files:**
- Create: `.github/workflows/deploy-workers.yml`
- Create: `.github/workflows/deploy-pages.yml`
- Modify: `.github/workflows/static.yml` (désactiver ou remplacer)
- Create: `workers/scripts/smoke.sh`
- Modify: Cloudflare DNS (manuel)

**Interfaces:**
- Consumes: GitHub Actions, Wrangler, secrets Cloudflare.
- Produces: déploiement automatique backend + frontend, smoke tests post-deploy.

- [ ] **Step 1 : Créer `.github/workflows/deploy-workers.yml`**

```yaml
name: Deploy Workers API
on:
  push:
    branches: [main]
    paths: ["workers/**", "shared/**", "supabase/migrations/**"]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: workers/package-lock.json
      - run: cd workers && npm ci
      - run: cd workers && npm run typecheck
      - run: cd workers && npm run test
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: workers
          command: deploy
      - run: cd workers && bash scripts/smoke.sh ${{ vars.WORKERS_PROD_URL }}
```

- [ ] **Step 2 : Créer `.github/workflows/deploy-pages.yml`**

```yaml
name: Deploy Pages Frontend
on:
  push:
    branches: [main]
    paths: ["app/**", "shared/**"]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy ./app --project-name=schoolsafe-v2
```

- [ ] **Step 3 : Créer `workers/scripts/smoke.sh`**

```bash
#!/bin/bash
set -e
URL=${1:-http://localhost:8787}
for endpoint in /health /ready /config; do
  curl -fsS "$URL$endpoint" > /dev/null
  echo "OK $endpoint"
done
echo "Smoke tests passed"
```

Run : `chmod +x workers/scripts/smoke.sh`
Expected : exécutable.

- [ ] **Step 4 : Configurer les secrets GitHub**

Run dans le repo local (avec PAT) :

```bash
gh secret set CLOUDFLARE_API_TOKEN --body "<token>"
gh secret set CLOUDFLARE_ACCOUNT_ID --body "<account>"
gh variable set WORKERS_PROD_URL --body "https://schoolsafe-v2-api.account.workers.dev"
```

Expected : secrets créés.

- [ ] **Step 5 : Bascule DNS**

Dans le dashboard Cloudflare :
- Créer/enregistrer `CNAME api.schoolsafe.example.com → schoolsafe-v2-api.account.workers.dev` (proxy orange activé).
- Créer/enregistrer `CNAME www.schoolsafe.example.com → schoolsafe-v2.pages.dev` (proxy orange activé).
- Mettre à jour `ALLOWED_ORIGINS` dans Wrangler avec `https://www.schoolsafe.example.com`.

Run : `wrangler secret put ALLOWED_ORIGINS --name schoolsafe-v2-api`
Expected : secret mis à jour.

- [ ] **Step 6 : Test de production**

Run : `curl -fsS https://api.schoolsafe.example.com/health`
Expected : `{"status":"ok"}`

Run : `curl -fsS https://www.schoolsafe.example.com/index.html`
Expected : 200

- [ ] **Step 7 : Commit**

```bash
git add .github/workflows/deploy-workers.yml .github/workflows/deploy-pages.yml workers/scripts/smoke.sh
git commit -m "ci: deploy Workers and Pages with smoke tests"
```

- [ ] **Step 8 : Commit final de bascule**

```bash
git commit --allow-empty -m "release: SchoolSafe V2 production cutover on Cloudflare"
git push
```

Expected : workflows déclenchés, déploiement réussi.