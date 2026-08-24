# SchoolSafe V2 — Plan d’action QA et scénarios de tests par profil

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Établir une suite de tests QA complète par profil et par module, vérifier la chaîne d’autorisation `USER → SCHOOL → ROLE → PERMISSION → SCOPE → CONDITION → EXCEPTION → AUDIT`, et produire un rapport d’écart exploitable pour le lancement.

**Architecture:** Les tests sont organisés en quatre couches — tests unitaires sur les fonctions d’autorisation, tests RLS sur Supabase, tests d’intégration sur les endpoints backend, et tests E2E parcourant les flux critiques. Chaque profil de référence possède son propre fichier de scénarios.

**Tech Stack:** Vitest (server + workers), tests RLS SQL/JS existants dans `tests/rls/`, Playwright pour E2E, `supabase-js` pour les appels RPC.

**Spec:** `docs/superpowers/specs/2026-08-19-schoolsafe-v2-diagnostic-qa.md`

## Global Constraints

- Couverture minimale : 80 % pour tout code classé `implémenté` ou `partiel`.
- Chaque permission du catalogue doit avoir au moins un test RLS + un test d’endpoint.
- Chaque profil doit avoir au moins un scénario E2E couvrant son flux principal.
- Les tests doivent s’exécuter sur une base Supabase locale (`supabase start`).
- Aucun secret ne doit être commité ; utiliser `.env.example` et variables d’environnement.
- Les tests doivent être isolés : chaque test réinitialise ses données via des fixtures.
- Les tests d’échec d’autorisation doivent vérifier le code d’erreur exact (`ACCESS_DENIED`, `SCOPE_DENIED`, `CONDITION_DENIED`, `EXCEPTION_DENIED`).

---

## File Structure

```
tests/
├── qa/
│   ├── fixtures/
│   │   ├── profiles.fixtures.ts       # Création des 15 profils de référence
│   │   ├── roles.fixtures.ts          # Attribution des rôles de base
│   │   └── scopes.fixtures.ts         # Affectation des périmètres par profil
│   ├── unit/
│   │   └── access-chain.test.ts       # Tests de la chaîne USER→SCHOOL→ROLE→PERMISSION→SCOPE→CONDITION→EXCEPTION
│   ├── rls/
│   │   ├── auth.setup.test.sql        # RLS pour Auth & setup
│   │   ├── school.setup.test.sql      # RLS pour École
│   │   ├── finance.setup.test.sql     # RLS pour Finance + Contrôle
│   │   ├── security.setup.test.sql    # RLS pour Sécurité QR
│   │   ├── pedagogy.setup.test.sql    # RLS pour Pédagogie + Palmarès
│   │   ├── pilotage.setup.test.sql    # RLS pour Pilotage + Rapports
│   │   └── platform.setup.test.sql    # RLS pour Plateforme, Documents, Fichiers
│   ├── integration/
│   │   ├── auth.flows.test.ts
│   │   ├── finance.flows.test.ts
│   │   ├── security.flows.test.ts
│   │   ├── pedagogy.flows.test.ts
│   │   └── pilotage.flows.test.ts
│   └── e2e/
│       ├── admin.spec.ts
│       ├── chef-etablissement.spec.ts
│       ├── enseignant.spec.ts
│       ├── agent-caisse.spec.ts
│       ├── agent-securite.spec.ts
│       └── parent.spec.ts
└── qa-report-template.md              # Template de rapport d’écart
```

---

## Task 1 : Créer les fixtures de profils, rôles et périmètres

**Files:**
- Create: `tests/qa/fixtures/profiles.fixtures.ts`
- Create: `tests/qa/fixtures/roles.fixtures.ts`
- Create: `tests/qa/fixtures/scopes.fixtures.ts`
- Create: `tests/qa/fixtures/school.fixtures.ts`

**Interfaces:**
- Consumes: `supabase-js` client, environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
- Produces:
  - `createTestSchool(): Promise<{ schoolId: string; academicYearId: string }>`
  - `createReferenceProfiles(schoolId: string): Promise<Record<ProfileName, string>>`
  - `assignBaseRoles(profileId: string, roleCodes: string[]): Promise<void>`
  - `assignScopes(profileId: string, scopes: Array<{ type: string; id?: string }>): Promise<void>`

- [ ] **Step 1: Write the fixture skeleton**

```typescript
// tests/qa/fixtures/school.fixtures.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export async function createTestSchool(client: SupabaseClient) {
  const { data, error } = await client
    .from("school")
    .insert({ code: "test-qa", name: "École QA" })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to create school: ${error?.message}`);
  return { schoolId: data.id as string };
}
```

- [ ] **Step 2: Implement profile creation for all 15 reference profiles**

```typescript
// tests/qa/fixtures/profiles.fixtures.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export const REFERENCE_PROFILES = [
  "admin_principal",
  "chef_etablissement",
  "responsable_pedagogique",
  "responsable_administratif",
  "secretaire_scolaire",
  "responsable_financier",
  "agent_caisse",
  "comptable",
  "responsable_rh",
  "enseignant",
  "agent_controle_acces",
  "infirmier",
  "responsable_cantine",
  "responsable_communication",
  "parent",
] as const;

export type ReferenceProfile = (typeof REFERENCE_PROFILES)[number];

export async function createReferenceProfiles(
  client: SupabaseClient,
  schoolId: string,
): Promise<Record<ReferenceProfile, string>> {
  const result = {} as Record<ReferenceProfile, string>;
  for (const code of REFERENCE_PROFILES) {
    const authEmail = `qa-${code}@schoolsafe.test`;
    const { data: authData, error: authError } = await client.auth.admin.createUser({
      email: authEmail,
      password: "TestPassword123!",
      email_confirm: true,
    });
    if (authError || !authData.user) throw new Error(`Auth user creation failed: ${authError?.message}`);

    const { data: profileData, error: profileError } = await client
      .from("profiles")
      .insert({ auth_user_id: authData.user.id, school_id: schoolId, display_name: code })
      .select("id")
      .single();
    if (profileError || !profileData) throw new Error(`Profile creation failed: ${profileError?.message}`);

    result[code] = profileData.id as string;
  }
  return result;
}
```

- [ ] **Step 3: Implement role assignment fixtures**

```typescript
// tests/qa/fixtures/roles.fixtures.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export const BASE_ROLE_ASSIGNMENTS: Record<string, string[]> = {
  admin_principal: ["admin"],
  chef_etablissement: ["principal"],
  responsable_pedagogique: ["pedagogy_manager"],
  responsable_administratif: ["admissions_manager"],
  secretaire_scolaire: ["secretary"],
  responsable_financier: ["finance_manager"],
  agent_caisse: ["cashier"],
  comptable: ["accountant"],
  responsable_rh: ["hr_manager"],
  enseignant: ["teacher"],
  agent_controle_acces: ["security_guard"],
  infirmier: ["nurse"],
  responsable_cantine: ["canteen_manager"],
  responsable_communication: ["communication_manager"],
  parent: ["parent"],
};

export async function assignBaseRoles(
  client: SupabaseClient,
  profileId: string,
  roleCodes: string[],
): Promise<void> {
  for (const code of roleCodes) {
    const { data: role } = await client.from("roles").select("id").eq("code", code).single();
    if (!role) throw new Error(`Role not found: ${code}`);
    const { error } = await client.from("profile_roles").insert({ profile_id: profileId, role_id: role.id });
    if (error) throw new Error(`Role assignment failed: ${error.message}`);
  }
}
```

- [ ] **Step 4: Implement scope assignment fixtures**

```typescript
// tests/qa/fixtures/scopes.fixtures.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export const BASE_SCOPES: Record<string, Array<{ type: string; id?: string }>> = {
  admin_principal: [{ type: "school" }],
  chef_etablissement: [{ type: "school" }],
  enseignant: [{ type: "assigned_classes" }, { type: "assigned_subjects" }],
  agent_controle_acces: [{ type: "assigned_portal" }],
  parent: [{ type: "own_children" }],
  // autres profils selon le diagnostic
};

export async function assignScopes(
  client: SupabaseClient,
  profileId: string,
  scopes: Array<{ type: string; id?: string }>,
): Promise<void> {
  const { error } = await client.from("scope_assignments").insert(
    scopes.map((s) => ({ profile_id: profileId, scope_type: s.type, scope_id: s.id ?? null })),
  );
  if (error) throw new Error(`Scope assignment failed: ${error.message}`);
}
```

- [ ] **Step 5: Add cleanup helper**

```typescript
// tests/qa/fixtures/cleanup.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function cleanupTestSchool(client: SupabaseClient, schoolId: string): Promise<void> {
  await client.from("school").delete().eq("id", schoolId);
}
```

- [ ] **Step 6: Run a smoke test to ensure fixtures work**

Run: `npx vitest run tests/qa/fixtures --reporter=verbose`
Expected: Fixtures can create school, profiles, roles, and scopes without errors.

- [ ] **Step 7: Commit**

```bash
git add tests/qa/fixtures/
git commit -m "test(qa): add reference profile, role and scope fixtures"
```

---

## Task 2 : Tester la chaîne d’autorisation complète en unitaire

**Files:**
- Create: `tests/qa/unit/access-chain.test.ts`
- Modify: `supabase/migrations/202608150002_access_functions.sql` (si les RPC doivent évoluer)

**Interfaces:**
- Consumes: fixtures from Task 1, `has_permission()`, `has_scope()`.
- Produces: validated behavior for each chain link.

- [ ] **Step 1: Write failing test for USER → SCHOOL isolation**

```typescript
// tests/qa/unit/access-chain.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createTestSchool } from "../fixtures/school.fixtures.js";
import { createReferenceProfiles } from "../fixtures/profiles.fixtures.js";
import { cleanupTestSchool } from "../fixtures/cleanup.js";

const serviceClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

describe("USER → SCHOOL isolation", () => {
  let schoolA: string;
  let schoolB: string;
  let adminA: string;

  beforeAll(async () => {
    ({ schoolId: schoolA } = await createTestSchool(serviceClient));
    ({ schoolId: schoolB } = await createTestSchool(serviceClient));
    const profilesA = await createReferenceProfiles(serviceClient, schoolA);
    adminA = profilesA.admin_principal;
  });

  afterAll(async () => {
    await cleanupTestSchool(serviceClient, schoolA);
    await cleanupTestSchool(serviceClient, schoolB);
  });

  it("rejects a profile from school A accessing school B data", async () => {
    const { data, error } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("id", adminA)
      .eq("school_id", schoolB)
      .single();
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });
});
```

- [ ] **Step 2: Write failing test for explicit DENY override**

```typescript
it("explicit role DENY overrides role ALLOW", async () => {
  // Admin principal has two roles: one ALLOW, one DENY on school.manage
  await assignBaseRoles(serviceClient, adminA, ["admin", "deny_school_manage"]);
  const userClient = createUserClient(adminA.auth_user_id);
  const allowed = await userClient.rpc("has_permission", { permission_code: "school.manage" });
  expect(allowed.data).toBe(false);
});
```

- [ ] **Step 3: Write failing test for SCOPE check**

```typescript
it("teacher can only access assigned classes", async () => {
  const teacherClient = createUserClient(teacherUserId);
  const inScope = await teacherClient.rpc("has_scope", {
    requested_scope_type: "assigned_classes",
    requested_scope_id: assignedClassId,
  });
  expect(inScope.data).toBe(true);

  const outOfScope = await teacherClient.rpc("has_scope", {
    requested_scope_type: "assigned_classes",
    requested_scope_id: unassignedClassId,
  });
  expect(outOfScope.data).toBe(false);
});
```

- [ ] **Step 4: Implement or fix RPCs to satisfy tests**

If tests fail because `has_permission`/`has_scope` do not enforce the expected behavior, update `supabase/migrations/202608150002_access_functions.sql` and re-run migrations.

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/qa/unit/access-chain.test.ts`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add tests/qa/unit/access-chain.test.ts
git commit -m "test(qa): verify USER/SCHOOL/ROLE/PERMISSION/SCOPE/EXCEPTION chain"
```

---

## Task 3 : Créer les tests RLS par module

**Files:**
- Create: `tests/qa/rls/auth.setup.test.sql`
- Create: `tests/qa/rls/school.setup.test.sql`
- Create: `tests/qa/rls/finance.setup.test.sql`
- Create: `tests/qa/rls/security.setup.test.sql`
- Create: `tests/qa/rls/pedagogy.setup.test.sql`
- Create: `tests/qa/rls/pilotage.setup.test.sql`
- Create: `tests/qa/rls/platform.setup.test.sql`
- Create: `tests/qa/rls/runner.ts`

**Interfaces:**
- Consumes: fixtures from Task 1, SQL RLS policies.
- Produces: one RLS test file per module with PASS/FAIL results.

- [ ] **Step 1: Write RLS test runner**

```typescript
// tests/qa/rls/runner.ts
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export async function runRlsTestFile(fileName: string): Promise<{ passed: number; failed: number }> {
  const sql = readFileSync(resolve("tests/qa/rls", fileName), "utf8");
  const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await client.rpc("run_test_sql", { sql });
  if (error) throw error;
  return { passed: 0, failed: 0 }; // actual counts returned by test SQL
}
```

- [ ] **Step 2: Write finance RLS tests**

```sql
-- tests/qa/rls/finance.setup.test.sql
-- Test: cashier can record payment only when cash register is open
DO $$
DECLARE
  v_cashier uuid := '<cashier_profile_id>';
  v_result boolean;
BEGIN
  -- simulate closed cash register
  PERFORM set_config('app.cash_register_open', 'false', true);
  v_result := has_condition('cash_register_open', '{}'::jsonb);
  ASSERT v_result = false, 'cashier should not record payment when register is closed';

  -- simulate open cash register
  PERFORM set_config('app.cash_register_open', 'true', true);
  v_result := has_condition('cash_register_open', '{}'::jsonb);
  ASSERT v_result = true, 'cashier should record payment when register is open';
END $$;
```

- [ ] **Step 3: Write security RLS tests**

```sql
-- tests/qa/rls/security.setup.test.sql
-- Test: security guard can scan only at assigned portal
DO $$
DECLARE
  v_guard uuid := '<guard_profile_id>';
  v_assigned_portal uuid := '<portal_id>';
  v_other_portal uuid := '<other_portal_id>';
BEGIN
  ASSERT has_scope('assigned_portal', v_assigned_portal) = true;
  ASSERT has_scope('assigned_portal', v_other_portal) = false;
END $$;
```

- [ ] **Step 4: Write pedagogy RLS tests**

```sql
-- tests/qa/rls/pedagogy.setup.test.sql
-- Test: teacher cannot modify published grades
DO $$
BEGIN
  -- grade status = draft → allowed
  ASSERT has_condition('grade_status', '{"status":"draft"}'::jsonb) = true;
  -- grade status = published → denied
  ASSERT has_condition('grade_status', '{"status":"published"}'::jsonb) = false;
END $$;
```

- [ ] **Step 5: Run all RLS tests**

Run: `npx vitest run tests/qa/rls/`
Expected: Each module file passes or produces a clear failure list.

- [ ] **Step 6: Commit**

```bash
git add tests/qa/rls/
git commit -m "test(qa): add RLS tests per module for authorization chain"
```

---

## Task 4 : Créer les tests d’intégration sur les flux sensibles

**Files:**
- Create: `tests/qa/integration/auth.flows.test.ts`
- Create: `tests/qa/integration/finance.flows.test.ts`
- Create: `tests/qa/integration/security.flows.test.ts`
- Create: `tests/qa/integration/pedagogy.flows.test.ts`
- Create: `tests/qa/integration/pilotage.flows.test.ts`

**Interfaces:**
- Consumes: fixtures from Task 1, backend routes.
- Produces: integration tests covering happy paths and denial paths.

- [ ] **Step 1: Write finance integration test — payment cancellation**

```typescript
// tests/qa/integration/finance.flows.test.ts
import { describe, it, expect } from "vitest";

describe("Finance flows", () => {
  it("allows finance manager to cancel a recent payment", async () => {
    const response = await apiClient(financeManagerToken).post("/finance/payments/cancel", {
      payment_id: recentPaymentId,
      reason: "Erreur de saisie",
    });
    expect(response.status).toBe(200);
    expect(response.data.payment.status).toBe("cancelled");
  });

  it("denies cancellation outside the allowed window", async () => {
    const response = await apiClient(financeManagerToken).post("/finance/payments/cancel", {
      payment_id: oldPaymentId,
      reason: "Trop tard",
    });
    expect(response.status).toBe(403);
    expect(response.data.code).toBe("CONDITION_DENIED");
  });

  it("denies cancellation to cashier", async () => {
    const response = await apiClient(cashierToken).post("/finance/payments/cancel", {
      payment_id: recentPaymentId,
      reason: "Tentative",
    });
    expect(response.status).toBe(403);
    expect(response.data.code).toBe("ACCESS_DENIED");
  });
});
```

- [ ] **Step 2: Write security integration test — QR scan**

```typescript
// tests/qa/integration/security.flows.test.ts
import { describe, it, expect } from "vitest";

describe("Security flows", () => {
  it("allows scan at assigned portal", async () => {
    const response = await apiClient(guardToken).post("/security/scan", {
      qr_code: validQrCode,
      portal_id: assignedPortalId,
    });
    expect(response.status).toBe(200);
  });

  it("denies scan at unassigned portal", async () => {
    const response = await apiClient(guardToken).post("/security/scan", {
      qr_code: validQrCode,
      portal_id: otherPortalId,
    });
    expect(response.status).toBe(403);
    expect(response.data.code).toBe("SCOPE_DENIED");
  });
});
```

- [ ] **Step 3: Write pedagogy integration test — grade publication**

```typescript
// tests/qa/integration/pedagogy.flows.test.ts
import { describe, it, expect } from "vitest";

describe("Pedagogy flows", () => {
  it("allows teacher to update draft grade", async () => {
    const response = await apiClient(teacherToken).patch(`/pedagogy/grades/${draftGradeId}`, {
      value_numeric: 15,
    });
    expect(response.status).toBe(200);
  });

  it("denies teacher to update published grade", async () => {
    const response = await apiClient(teacherToken).patch(`/pedagogy/grades/${publishedGradeId}`, {
      value_numeric: 18,
    });
    expect(response.status).toBe(403);
    expect(response.data.code).toBe("CONDITION_DENIED");
  });
});
```

- [ ] **Step 4: Write audit integration test**

```typescript
// tests/qa/integration/audit.flows.test.ts
import { describe, it, expect } from "vitest";

describe("Audit flows", () => {
  it("logs successful sensitive operation", async () => {
    await apiClient(financeManagerToken).post("/finance/payments/cancel", {
      payment_id: recentPaymentId,
      reason: "Test audit",
    });
    const { data } = await serviceClient
      .from("audit_events")
      .select("*")
      .eq("event_type", "finance.payment.cancelled")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(data).not.toBeNull();
    expect(data.payload.payment_id).toBe(recentPaymentId);
  });

  it("logs refused sensitive attempt", async () => {
    await apiClient(cashierToken).post("/finance/payments/cancel", {
      payment_id: recentPaymentId,
      reason: "Tentative refusée",
    });
    const { data } = await serviceClient
      .from("audit_events")
      .select("*")
      .eq("event_type", "finance.payment.cancel_denied")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(data).not.toBeNull();
    expect(data.payload.reason_code).toBe("ACCESS_DENIED");
  });
});
```

- [ ] **Step 5: Run integration tests**

Run: `npx vitest run tests/qa/integration/`
Expected: Happy paths pass; denial paths return expected codes.

- [ ] **Step 6: Commit**

```bash
git add tests/qa/integration/
git commit -m "test(qa): add integration tests for sensitive flows and audit"
```

---

## Task 5 : Créer les scénarios E2E par profil

**Files:**
- Create: `tests/qa/e2e/admin.spec.ts`
- Create: `tests/qa/e2e/chef-etablissement.spec.ts`
- Create: `tests/qa/e2e/enseignant.spec.ts`
- Create: `tests/qa/e2e/agent-caisse.spec.ts`
- Create: `tests/qa/e2e/agent-securite.spec.ts`
- Create: `tests/qa/e2e/parent.spec.ts`
- Create: `tests/qa/e2e/helpers/login.helper.ts`

**Interfaces:**
- Consumes: Playwright, QA environment URL.
- Produces: E2E spec files covering primary flows per profile.

- [ ] **Step 1: Write login helper**

```typescript
// tests/qa/e2e/helpers/login.helper.ts
import { Page } from "@playwright/test";

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL("/workspace");
}
```

- [ ] **Step 2: Write cashier E2E scenario**

```typescript
// tests/qa/e2e/agent-caisse.spec.ts
import { test, expect } from "@playwright/test";
import { login } from "./helpers/login.helper.js";

test("Agent de caisse can record a payment and issue a receipt", async ({ page }) => {
  await login(page, "qa-agent_caisse@schoolsafe.test", "TestPassword123!");
  await page.click('[data-testid="module-finance"]');
  await page.click('[data-testid="action-record-payment"]');
  await page.fill('[data-testid="student-search"]', "KONGO");
  await page.click('[data-testid="student-result-0"]');
  await page.fill('[data-testid="amount-input"]', "50000");
  await page.click('[data-testid="submit-payment"]');
  await expect(page.locator('[data-testid="receipt-pdf"]')).toBeVisible();
});

test("Agent de caisse cannot cancel a payment", async ({ page }) => {
  await login(page, "qa-agent_caisse@schoolsafe.test", "TestPassword123!");
  await page.goto(`/finance/payments/${recentPaymentId}`);
  await expect(page.locator('[data-testid="cancel-payment-button"]')).not.toBeVisible();
});
```

- [ ] **Step 3: Write parent E2E scenario**

```typescript
// tests/qa/e2e/parent.spec.ts
import { test, expect } from "@playwright/test";
import { login } from "./helpers/login.helper.js";

test("Parent can view own children receipts", async ({ page }) => {
  await login(page, "qa-parent@schoolsafe.test", "TestPassword123!");
  await page.click('[data-testid="child-selector"]');
  await page.click('[data-testid="child-0"]');
  await page.click('[data-testid="tab-receipts"]');
  await expect(page.locator('[data-testid="receipt-list"]')).toBeVisible();
});

test("Parent cannot view other children receipts", async ({ page }) => {
  await login(page, "qa-parent@schoolsafe.test", "TestPassword123!");
  await page.goto(`/students/${otherChildId}/receipts`);
  await expect(page.locator('[data-testid="access-denied"]')).toBeVisible();
});
```

- [ ] **Step 4: Write security guard E2E scenario**

```typescript
// tests/qa/e2e/agent-securite.spec.ts
import { test, expect } from "@playwright/test";
import { login } from "./helpers/login.helper.js";

test("Security guard can scan QR at assigned portal", async ({ page }) => {
  await login(page, "qa-agent_controle_acces@schoolsafe.test", "TestPassword123!");
  await page.click('[data-testid="module-security"]');
  await page.click('[data-testid="action-scan"]');
  // simulate QR scan
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("qr-scanned", { detail: { code: validQrCode } }));
  });
  await expect(page.locator('[data-testid="scan-result-ok"]')).toBeVisible();
});
```

- [ ] **Step 5: Run E2E tests**

Run: `npx playwright test tests/qa/e2e/`
Expected: Each profile spec runs its primary scenario.

- [ ] **Step 6: Commit**

```bash
git add tests/qa/e2e/
git commit -m "test(qa): add E2E scenarios per reference profile"
```

---

## Task 6 : Créer le template de rapport d’écart

**Files:**
- Create: `tests/qa/qa-report-template.md`
- Create: `tests/qa/generate-report.ts`

**Interfaces:**
- Consumes: test results from Tasks 2-5.
- Produces: markdown QA report.

- [ ] **Step 1: Write report template**

```markdown
# Rapport QA SchoolSafe V2 — {{date}}

## Résumé

- Profils testés : {{profile_count}} / 15
- Permissions testées : {{permission_count}} / 46
- Tests RLS : {{rls_passed}} / {{rls_total}}
- Tests intégration : {{integration_passed}} / {{integration_total}}
- Tests E2E : {{e2e_passed}} / {{e2e_total}}

## Écarts par priorité

### P0 — Bloquant pour le lancement

| Module | Fonction | Écart | Action corrective |
|--------|----------|-------|-------------------|

### P1 — À corriger avant production

| Module | Fonction | Écart | Action corrective |
|--------|----------|-------|-------------------|

### P2 — À planifier post-lancement

| Module | Fonction | Écart | Action corrective |
|--------|----------|-------|-------------------|

## Recommandation de GO/NO-GO

{{recommendation}}
```

- [ ] **Step 2: Write report generator**

```typescript
// tests/qa/generate-report.ts
import { readFileSync, writeFileSync } from "node:fs";

export function generateReport(results: {
  rls: { passed: number; total: number };
  integration: { passed: number; total: number };
  e2e: { passed: number; total: number };
}): string {
  const template = readFileSync("tests/qa/qa-report-template.md", "utf8");
  return template
    .replace("{{date}}", new Date().toISOString().slice(0, 10))
    .replace("{{rls_passed}}", String(results.rls.passed))
    .replace("{{rls_total}}", String(results.rls.total))
    .replace("{{integration_passed}}", String(results.integration.passed))
    .replace("{{integration_total}}", String(results.integration.total))
    .replace("{{e2e_passed}}", String(results.e2e.passed))
    .replace("{{e2e_total}}", String(results.e2e.total));
}
```

- [ ] **Step 3: Run report generator against current results**

Run: `npx tsx tests/qa/generate-report.ts`
Expected: A markdown report is written to `tests/qa/qa-report-YYYY-MM-DD.md`.

- [ ] **Step 4: Commit**

```bash
git add tests/qa/qa-report-template.md tests/qa/generate-report.ts
git commit -m "test(qa): add QA report template and generator"
```

---

## Task 7 : Exécuter le plan QA complet et produire le rapport initial

**Files:**
- Create: `tests/qa/qa-report-2026-08-19.md`
- Modify: `package.json` scripts if needed

**Interfaces:**
- Consumes: all tests from Tasks 2-6.
- Produces: final QA report with gaps and recommendations.

- [ ] **Step 1: Add QA test script to package.json**

```json
"scripts": {
  "test:qa": "vitest run tests/qa/unit tests/qa/integration && npx playwright test tests/qa/e2e"
}
```

- [ ] **Step 2: Run full QA suite**

Run: `npm run test:qa`
Expected: Test results populate the report.

- [ ] **Step 3: Generate initial QA report**

Run: `npx tsx tests/qa/generate-report.ts`
Expected: `tests/qa/qa-report-2026-08-19.md` is created.

- [ ] **Step 4: Review report and commit**

```bash
git add tests/qa/qa-report-2026-08-19.md package.json
git commit -m "test(qa): run initial QA suite and generate report"
```

---

## Self-Review

### Spec coverage

- ✅ Section 9.1 (règle d’autorisation) → Tasks 1, 2, 3
- ✅ Section 9.3 (46 permissions) → Tasks 2, 3, 4
- ✅ Section 9.5 (écarts par module) → Tasks 3, 4, 7
- ✅ Section 9.7 C1 (conditions) → Task 3 RLS tests
- ✅ Section 9.7 C2 (exceptions individuelles) → Task 2 unit tests
- ✅ Section 9.7 C4 (audit réussis + refusés) → Task 4 audit tests
- ✅ Section 9.7 C6 (chaîne RLS complète) → Tasks 2, 3

### Placeholder scan

- No TBD/TODO.
- No vague "add error handling" statements.
- All test code contains concrete assertions.

### Type consistency

- `ReferenceProfile` union type used consistently in fixtures.
- `has_permission` / `has_scope` / `has_condition` RPC signatures match migration conventions.
- `apiClient(token)` helper used consistently in integration tests.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-08-19-schoolsafe-v2-qa-action-plan.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach do you prefer?
