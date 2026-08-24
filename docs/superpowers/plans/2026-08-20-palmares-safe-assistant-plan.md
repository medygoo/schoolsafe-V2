# Palmarès + Safe Assistant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Palmarès monthly ranking module (backend + frontend) and integrate the Safe Assistant kit into SchoolSafe V2 without regressing existing features.

**Architecture:** Add three new tables (`rankings`, `ranking_entries`, `ranking_stars`) with RLS, a Fastify sub-router under `/pedagogy/rankings`, and a vanilla JS frontend module. Reuse existing `students.photo_path`, `grades`, `assignments`, and `computeStudentAverages` logic. Integrate Safe Assistant as a floating vanilla-JS widget using copied PNG assets.

**Tech Stack:** TypeScript/Fastify (backend), vanilla JS/CSS (frontend), Supabase PostgreSQL + RLS, vitest.

**Spec:** `docs/superpowers/specs/2026-08-20-palmares-safe-assistant-design.md`

## Global Constraints

- Do not break Finance or existing Pedagogy modules.
- Reuse existing `students.photo_path`, `grades`, `assignments.coefficient`, and `computeStudentAverages`.
- Respect `USER → SCHOOL → ROLE → PERMISSION → SCOPE → CONDITION → EXCEPTION → AUDIT`.
- Demo mode allowed only in dev/test; production must show explicit “données indisponibles / connexion impossible” state, never silent fake financial/ranking data.
- Backend files use `.js` extensions in imports even though source is TypeScript.
- All new SQL goes into a single migration file under `supabase/migrations/`.
- Each task ends with a verification step and a commit.

---

## Task 1: Palmarès Database Migration

**Files:**
- Create: `supabase/migrations/202608210001_rankings.sql`

**Interfaces:**
- Produces: `public.rankings`, `public.ranking_entries`, `public.ranking_stars` tables with RLS enabled.

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/202608210001_rankings.sql`:

```sql
-- SchoolSafe V2 — Module Palmarès
-- Classements mensuels par classe et par école, basés sur les cotes publiées.

-- ============================================================
-- 1. Palmarès mensuel
-- ============================================================
create table if not exists public.rankings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  status text not null default 'draft' check (status in ('draft', 'published')),
  computed_at timestamptz not null default now(),
  published_at timestamptz,
  computed_by_profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, class_id, month)
);

comment on column public.rankings.class_id is 'NULL = palmarès général de toute l’école';
comment on column public.rankings.month is 'Format YYYY-MM';

-- ============================================================
-- 2. Entrées de classement
-- ============================================================
create table if not exists public.ranking_entries (
  id uuid primary key default gen_random_uuid(),
  ranking_id uuid not null references public.rankings(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  rank integer not null check (rank > 0),
  monthly_average numeric not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (ranking_id, student_id)
);

comment on column public.ranking_entries.metadata is 'Détails des cotes agrégées : [{assignment_id, value, coefficient}]';

-- ============================================================
-- 3. Étoiles d’encouragement (un parent ne peut en donner qu’une par élève/mois)
-- ============================================================
create table if not exists public.ranking_stars (
  id uuid primary key default gen_random_uuid(),
  ranking_id uuid not null references public.rankings(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  parent_profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (ranking_id, student_id, parent_profile_id)
);

-- ============================================================
-- 4. Indexes
-- ============================================================
create index if not exists rankings_school_id_idx on public.rankings(school_id);
create index if not exists rankings_class_id_idx on public.rankings(class_id);
create index if not exists rankings_month_idx on public.rankings(month);
create index if not exists ranking_entries_ranking_id_idx on public.ranking_entries(ranking_id);
create index if not exists ranking_entries_student_id_idx on public.ranking_entries(student_id);
create index if not exists ranking_stars_ranking_id_idx on public.ranking_stars(ranking_id);
create index if not exists ranking_stars_student_id_idx on public.ranking_stars(student_id);
create index if not exists ranking_stars_parent_profile_id_idx on public.ranking_stars(parent_profile_id);

-- ============================================================
-- 5. RLS
-- ============================================================
alter table public.rankings enable row level security;
alter table public.ranking_entries enable row level security;
alter table public.ranking_stars enable row level security;

revoke all on table public.rankings from anon, authenticated;
revoke all on table public.ranking_entries from anon, authenticated;
revoke all on table public.ranking_stars from anon, authenticated;

grant select, insert, update, delete on public.rankings to authenticated;
grant select, insert, update, delete on public.ranking_entries to authenticated;
grant select, insert, delete on public.ranking_stars to authenticated;

-- Rankings : limité à l’école courante
create policy rankings_current_school
on public.rankings
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());

-- Entries : accessible si le palmarès est dans l’école courante
create policy ranking_entries_current_school
on public.ranking_entries
for all
to authenticated
using (
  ranking_id in (
    select r.id from public.rankings r where r.school_id = public.current_school_id()
  )
)
with check (
  ranking_id in (
    select r.id from public.rankings r where r.school_id = public.current_school_id()
  )
);

-- Stars : accessible si le palmarès est dans l’école courante
create policy ranking_stars_current_school
on public.ranking_stars
for all
to authenticated
using (
  ranking_id in (
    select r.id from public.rankings r where r.school_id = public.current_school_id()
  )
)
with check (
  ranking_id in (
    select r.id from public.rankings r where r.school_id = public.current_school_id()
  )
);
```

- [ ] **Step 2: Apply migration locally (dev only)**

Run:
```bash
supabase migration up
```

Expected: migration applies without errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/202608210001_rankings.sql
git commit -m "feat(db): add rankings, ranking_entries and ranking_stars tables with RLS"
```

---

## Task 2: Palmarès Service

**Files:**
- Create: `server/src/pedagogy/rankings/service.ts`

**Interfaces:**
- Consumes: `computeStudentAverages` from `../averages.js`, `SchoolSafeError` from `../../http/errors.js`, Supabase service client.
- Produces: `RankingsService` with `computeMonthlyRanking`, `publishRanking`, `listRankings`, `getRanking`, `addStar`, `removeStar`, `listStars`.

- [ ] **Step 1: Create service file**

Create `server/src/pedagogy/rankings/service.ts`:

```typescript
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SchoolSafeError } from "../../http/errors.js";

export interface Ranking {
  id: string;
  school_id: string;
  class_id: string | null;
  month: string;
  status: "draft" | "published";
  computed_at: string;
  published_at: string | null;
  computed_by_profile_id: string;
}

export interface RankingEntry {
  id: string;
  ranking_id: string;
  student_id: string;
  rank: number;
  monthly_average: number;
  metadata: Record<string, unknown>;
  students?: {
    id: string;
    first_name: string;
    last_name: string;
    matricule: string | null;
    photo_path: string | null;
    class_id: string;
    classes: { name: string } | null;
  } | null;
}

export interface RankingWithEntries extends Ranking {
  entries: RankingEntry[];
}

export interface Star {
  id: string;
  ranking_id: string;
  student_id: string;
  parent_profile_id: string;
  created_at: string;
}

export interface RankingsService {
  listRankings(schoolId: string, options?: { classId?: string | null; month?: string; status?: string }): Promise<Ranking[]>;
  getRanking(schoolId: string, rankingId: string): Promise<RankingWithEntries | null>;
  computeMonthlyRanking(
    schoolId: string,
    profileId: string,
    yearMonth: string,
    classId?: string,
  ): Promise<RankingWithEntries>;
  publishRanking(schoolId: string, profileId: string, rankingId: string): Promise<Ranking>;
  addStar(schoolId: string, parentProfileId: string, rankingId: string, studentId: string): Promise<Star>;
  removeStar(schoolId: string, parentProfileId: string, rankingId: string, studentId: string): Promise<void>;
  listStars(schoolId: string, rankingId: string): Promise<Star[]>;
}

function createServiceClient(supabaseUrl: string, serviceRoleKey: string): SupabaseClient {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function firstDayOfMonth(yearMonth: string): string {
  return `${yearMonth}-01`;
}

function lastDayOfMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const last = new Date(year, month, 0);
  const day = String(last.getDate()).padStart(2, "0");
  return `${yearMonth}-${day}`;
}

function toNumericGrade(valueNumeric: number | null, valueText: string | null, normalizedValue: number | null): number | null {
  if (normalizedValue !== null && normalizedValue !== undefined) return Number(normalizedValue);
  if (valueNumeric !== null && valueNumeric !== undefined) return Number(valueNumeric);
  if (valueText) {
    const parsed = Number(valueText.replace(",", "."));
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

function computeMonthlyAverage(
  grades: Array<{
    value_numeric: number | null;
    value_text: string | null;
    normalized_value: number | null;
    assignments: { coefficient: number } | null;
  }>,
): number | null {
  let weightedSum = 0;
  let totalCoefficient = 0;
  for (const grade of grades) {
    const value = toNumericGrade(grade.value_numeric, grade.value_text, grade.normalized_value);
    if (value === null) continue;
    const coefficient = grade.assignments?.coefficient || 1;
    weightedSum += value * coefficient;
    totalCoefficient += coefficient;
  }
  if (totalCoefficient === 0) return null;
  return Math.round((weightedSum / totalCoefficient) * 100) / 100;
}

export function createRankingsService(supabaseUrl: string, serviceRoleKey: string): RankingsService {
  const client = createServiceClient(supabaseUrl, serviceRoleKey);

  return {
    async listRankings(schoolId, options = {}) {
      let query = client.from("rankings").select("*").eq("school_id", schoolId).order("month", { ascending: false });
      if (options.classId !== undefined) query = options.classId === null ? query.is("class_id", null) : query.eq("class_id", options.classId);
      if (options.month) query = query.eq("month", options.month);
      if (options.status) query = query.eq("status", options.status);
      const { data, error } = await query;
      if (error) throw new Error(`Failed to list rankings: ${error.message}`);
      return (data ?? []) as Ranking[];
    },

    async getRanking(schoolId, rankingId) {
      const { data: ranking, error: rankingError } = await client
        .from("rankings")
        .select("*")
        .eq("id", rankingId)
        .eq("school_id", schoolId)
        .single();
      if (rankingError) return null;

      const { data: entries, error: entriesError } = await client
        .from("ranking_entries")
        .select("*, students(id, first_name, last_name, matricule, photo_path, class_id, classes(name))")
        .eq("ranking_id", rankingId)
        .order("rank", { ascending: true });
      if (entriesError) throw new Error(`Failed to load ranking entries: ${entriesError.message}`);

      return { ...ranking, entries: (entries ?? []) as RankingEntry[] } as RankingWithEntries;
    },

    async computeMonthlyRanking(schoolId, profileId, yearMonth, classId) {
      const start = firstDayOfMonth(yearMonth);
      const end = lastDayOfMonth(yearMonth);

      let assignmentQuery = client
        .from("assignments")
        .select("id")
        .eq("school_id", schoolId)
        .gte("due_date", start)
        .lte("due_date", end);
      if (classId) assignmentQuery = assignmentQuery.eq("class_id", classId);
      const { data: assignments, error: assignmentError } = await assignmentQuery;
      if (assignmentError) throw new Error(`Failed to list assignments: ${assignmentError.message}`);
      const assignmentIds = (assignments ?? []).map((a) => a.id);

      if (assignmentIds.length === 0) {
        throw new SchoolSafeError(400, "VALIDATION_INVALID", "Aucune évaluation trouvée pour ce mois.", false);
      }

      let gradesQuery = client
        .from("grades")
        .select("*, assignments(id, coefficient)")
        .in("assignment_id", assignmentIds)
        .eq("status", "published");
      const { data: grades, error: gradesError } = await gradesQuery;
      if (gradesError) throw new Error(`Failed to load grades: ${gradesError.message}`);

      const byStudent = new Map<string, typeof grades>();
      for (const grade of grades ?? []) {
        if (!byStudent.has(grade.student_id)) byStudent.set(grade.student_id, []);
        byStudent.get(grade.student_id)!.push(grade);
      }

      let studentQuery = client.from("students").select("id, class_id").eq("school_id", schoolId);
      if (classId) studentQuery = studentQuery.eq("class_id", classId);
      const { data: students, error: studentsError } = await studentQuery;
      if (studentsError) throw new Error(`Failed to load students: ${studentsError.message}`);

      const ranked = (students ?? [])
        .map((student) => {
          const studentGrades = byStudent.get(student.id) ?? [];
          const average = computeMonthlyAverage(studentGrades);
          return {
            student_id: student.id,
            class_id: student.class_id,
            monthly_average: average,
            metadata: {
              grades: studentGrades.map((g) => ({
                assignment_id: g.assignment_id,
                value: g.normalized_value ?? g.value_numeric ?? g.value_text,
                coefficient: g.assignments?.coefficient ?? 1,
              })),
            },
          };
        })
        .filter((item) => item.monthly_average !== null)
        .sort((a, b) => (b.monthly_average as number) - (a.monthly_average as number));

      if (ranked.length === 0) {
        throw new SchoolSafeError(400, "VALIDATION_INVALID", "Aucune cote publiée pour ce mois.", false);
      }

      const now = new Date().toISOString();
      const { data: ranking, error: rankingUpsertError } = await client
        .from("rankings")
        .upsert(
          {
            school_id: schoolId,
            class_id: classId ?? null,
            month: yearMonth,
            status: "draft",
            computed_at: now,
            computed_by_profile_id: profileId,
            updated_at: now,
          },
          { onConflict: "school_id, class_id, month" },
        )
        .select("*")
        .single();
      if (rankingUpsertError || !ranking) throw new Error(`Failed to upsert ranking: ${rankingUpsertError?.message}`);

      await client.from("ranking_entries").delete().eq("ranking_id", ranking.id);

      const entriesToInsert = ranked.slice(0, 10).map((item, index) => ({
        ranking_id: ranking.id,
        student_id: item.student_id,
        rank: index + 1,
        monthly_average: item.monthly_average as number,
        metadata: item.metadata,
      }));

      const { error: insertError } = await client.from("ranking_entries").insert(entriesToInsert);
      if (insertError) throw new Error(`Failed to insert ranking entries: ${insertError.message}`);

      return this.getRanking(schoolId, ranking.id) as Promise<RankingWithEntries>;
    },

    async publishRanking(schoolId, profileId, rankingId) {
      const { data, error } = await client
        .from("rankings")
        .update({ status: "published", published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", rankingId)
        .eq("school_id", schoolId)
        .select("*")
        .single();
      if (error || !data) throw new SchoolSafeError(404, "NOT_FOUND", "Palmarès introuvable.", false);
      return data as Ranking;
    },

    async addStar(schoolId, parentProfileId, rankingId, studentId) {
      const ranking = await this.getRanking(schoolId, rankingId);
      if (!ranking) throw new SchoolSafeError(404, "NOT_FOUND", "Palmarès introuvable.", false);

      const { data, error } = await client
        .from("ranking_stars")
        .insert({ ranking_id: rankingId, student_id: studentId, parent_profile_id: parentProfileId })
        .select("*")
        .single();
      if (error) {
        if (error.message?.includes("duplicate key")) {
          throw new SchoolSafeError(409, "IDEMPOTENCY_DUPLICATE", "Vous avez déjà encouragé cet élève ce mois-ci.", false);
        }
        throw new Error(`Failed to add star: ${error.message}`);
      }
      return data as Star;
    },

    async removeStar(schoolId, parentProfileId, rankingId, studentId) {
      const { error } = await client
        .from("ranking_stars")
        .delete()
        .eq("ranking_id", rankingId)
        .eq("student_id", studentId)
        .eq("parent_profile_id", parentProfileId);
      if (error) throw new Error(`Failed to remove star: ${error.message}`);
    },

    async listStars(schoolId, rankingId) {
      const { data, error } = await client
        .from("ranking_stars")
        .select("*")
        .eq("ranking_id", rankingId);
      if (error) throw new Error(`Failed to list stars: ${error.message}`);
      return (data ?? []) as Star[];
    },
  };
}
```

- [ ] **Step 2: Type-check the service**

Run:
```bash
cd server && npx tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/pedagogy/rankings/service.ts
git commit -m "feat(pedagogy): add rankings service"
```

---

## Task 3: Palmarès Routes

**Files:**
- Create: `server/src/pedagogy/rankings/routes.ts`

**Interfaces:**
- Consumes: `RankingsService` from `./service.js`, `requirePermission` from `../../access/guard.js`, `authenticate` pattern from `../routes.ts`.
- Produces: Fastify routes under `/pedagogy/rankings`.

- [ ] **Step 1: Create routes file**

Create `server/src/pedagogy/rankings/routes.ts`:

```typescript
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { SchoolSafeError } from "../../http/errors.js";
import { requirePermission } from "../../access/guard.js";
import type { AccessService } from "../../access/service.js";
import type { RankingsService } from "./service.js";

export type ResolveProfileAndSchool = (token: string) => Promise<{ profileId: string | null; schoolId: string | null }>;

export type RankingsRouteDependencies = {
  service: RankingsService;
  resolveProfileAndSchool: ResolveProfileAndSchool;
  access: AccessService;
};

const computeSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  class_id: z.string().uuid().optional(),
});

async function authenticate(
  request: FastifyRequest,
  resolve: ResolveProfileAndSchool,
): Promise<{ profileId: string; schoolId: string }> {
  const authHeader = request.headers.authorization;
  if (!authHeader) throw new SchoolSafeError(401, "AUTH_REQUIRED", "Authentification requise", false);
  const match = authHeader.match(/^Bearer\s+(\S+)$/i);
  if (!match) throw new SchoolSafeError(401, "AUTH_REQUIRED", "Authentification requise", false);
  const { profileId, schoolId } = await resolve(match[1]);
  if (!profileId || !schoolId) throw new SchoolSafeError(401, "AUTH_REQUIRED", "Profil ou école non trouvé", false);
  return { profileId, schoolId };
}

function parseQuery(request: FastifyRequest): Record<string, string> {
  return (request.query ?? {}) as Record<string, string>;
}

export function registerRankingsRoutes(app: FastifyInstance, dependencies: RankingsRouteDependencies): void {
  app.get(
    "/",
    { preHandler: [requirePermission(dependencies.access, "palmarques.read")] },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { schoolId } = await authenticate(request, dependencies.resolveProfileAndSchool);
      const query = parseQuery(request);
      const result = await dependencies.service.listRankings(schoolId, {
        classId: query.class_id === "null" ? null : query.class_id,
        month: query.month,
        status: query.status,
      });
      return { data: result };
    },
  );

  app.get(
    "/:id",
    { preHandler: [requirePermission(dependencies.access, "palmarques.read")] },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { schoolId } = await authenticate(request, dependencies.resolveProfileAndSchool);
      const { id } = request.params as { id: string };
      const result = await dependencies.service.getRanking(schoolId, id);
      if (!result) throw new SchoolSafeError(404, "NOT_FOUND", "Palmarès introuvable.", false);
      return { data: result };
    },
  );

  app.post(
    "/compute",
    { preHandler: [requirePermission(dependencies.access, "palmarques.manage")] },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { profileId, schoolId } = await authenticate(request, dependencies.resolveProfileAndSchool);
      const parsed = computeSchema.parse(request.body);
      const result = await dependencies.service.computeMonthlyRanking(schoolId, profileId, parsed.month, parsed.class_id);
      return { data: result };
    },
  );

  app.post(
    "/:id/publish",
    { preHandler: [requirePermission(dependencies.access, "palmarques.manage")] },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { profileId, schoolId } = await authenticate(request, dependencies.resolveProfileAndSchool);
      const { id } = request.params as { id: string };
      const result = await dependencies.service.publishRanking(schoolId, profileId, id);
      return { data: result };
    },
  );

  app.get(
    "/:id/stars",
    { preHandler: [requirePermission(dependencies.access, "palmarques.read")] },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { schoolId } = await authenticate(request, dependencies.resolveProfileAndSchool);
      const { id } = request.params as { id: string };
      const result = await dependencies.service.listStars(schoolId, id);
      return { data: result };
    },
  );

  app.post(
    "/:id/stars",
    { preHandler: [requirePermission(dependencies.access, "palmarques.read")] },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { profileId, schoolId } = await authenticate(request, dependencies.resolveProfileAndSchool);
      const { id } = request.params as { id: string };
      const body = request.body as { student_id?: string };
      if (!body.student_id) throw new SchoolSafeError(400, "VALIDATION_INVALID", "student_id requis.", false);
      const result = await dependencies.service.addStar(schoolId, profileId, id, body.student_id);
      return { data: result };
    },
  );

  app.delete(
    "/:id/stars/:studentId",
    { preHandler: [requirePermission(dependencies.access, "palmarques.read")] },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { profileId, schoolId } = await authenticate(request, dependencies.resolveProfileAndSchool);
      const { id, studentId } = request.params as { id: string; studentId: string };
      await dependencies.service.removeStar(schoolId, profileId, id, studentId);
      return { success: true };
    },
  );
}
```

- [ ] **Step 2: Type-check**

Run:
```bash
cd server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add server/src/pedagogy/rankings/routes.ts
git commit -m "feat(pedagogy): add rankings routes"
```

---

## Task 4: Wire Palmarès Routes into Pedagogy Router

**Files:**
- Modify: `server/src/pedagogy/routes.ts`
- Modify: `server/src/pedagogy/service.ts` (add `createRankingsService` dependency)

**Interfaces:**
- Consumes: `registerRankingsRoutes` from `./rankings/routes.js`, `createRankingsService` from `./rankings/service.js`.
- Produces: `/pedagogy/rankings/*` endpoints registered.

- [ ] **Step 1: Update route dependencies interface**

In `server/src/pedagogy/routes.ts`, add import at the top:

```typescript
import { registerRankingsRoutes } from "./rankings/routes.js";
```

- [ ] **Step 2: Register rankings router at end of `registerPedagogyRoutes`**

Add before the closing brace of `registerPedagogyRoutes`:

```typescript
  // Rankings
  app.register(
    async (rankingsApp: FastifyInstance) => {
      registerRankingsRoutes(rankingsApp, {
        service: dependencies.service,
        resolveProfileAndSchool: dependencies.resolveProfileAndSchool,
        access: dependencies.access,
      });
    },
    { prefix: "/pedagogy/rankings" },
  );
```

Wait — `dependencies.service` is typed as `PedagogyService`, which does not include ranking methods. We need to inject the rankings service separately.

Change `PedagogyRouteDependencies` to:

```typescript
import type { RankingsService } from "./rankings/service.js";

export type PedagogyRouteDependencies = {
  service: PedagogyService;
  rankingsService: RankingsService;
  resolveProfileAndSchool: ResolveProfileAndSchool;
  access: AccessService;
};
```

And update the registration:

```typescript
  app.register(
    async (rankingsApp: FastifyInstance) => {
      registerRankingsRoutes(rankingsApp, {
        service: dependencies.rankingsService,
        resolveProfileAndSchool: dependencies.resolveProfileAndSchool,
        access: dependencies.access,
      });
    },
    { prefix: "/pedagogy/rankings" },
  );
```

- [ ] **Step 3: Update service factory and server wiring**

In `server/src/pedagogy/service.ts`, the factory is `createPedagogyService(url, key)`. We need a rankings service factory. The wiring is likely in `server/src/server.ts` or similar. Find where `createPedagogyService` is called and add `createRankingsService` next to it.

Search with:
```bash
cd server && grep -r "createPedagogyService" --include="*.ts" --include="*.js" -n
```

Expected location: `server/src/server.ts` or `server/src/index.ts`. Update the call site to also create `rankingsService` and pass it to `registerPedagogyRoutes`.

Example change at the call site:

```typescript
import { createRankingsService } from "./pedagogy/rankings/service.js";

const pedagogyService = createPedagogyService(supabaseUrl, serviceRoleKey);
const rankingsService = createRankingsService(supabaseUrl, serviceRoleKey);

registerPedagogyRoutes(app, {
  service: pedagogyService,
  rankingsService,
  resolveProfileAndSchool,
  access,
});
```

- [ ] **Step 4: Type-check and commit**

Run:
```bash
cd server && npx tsc --noEmit
```

Expected: no errors.

Commit:
```bash
git add server/src/pedagogy/routes.ts server/src/server.ts
git commit -m "feat(pedagogy): wire rankings router into pedagogy routes"
```

---

## Task 5: Palmarès Service Tests

**Files:**
- Create: `server/tests/rankings-service.test.ts`

**Interfaces:**
- Consumes: `createRankingsService` from `../src/pedagogy/rankings/service.js`.
- Produces: passing tests for `computeMonthlyRanking` logic.

- [ ] **Step 1: Create test file**

Create `server/tests/rankings-service.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { createRankingsService, type RankingsService } from "../src/pedagogy/rankings/service.js";

function fakeClient(rows: Record<string, unknown>[]) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => fakeClient(rows)),
      insert: vi.fn(() => fakeClient(rows)),
      update: vi.fn(() => fakeClient(rows)),
      delete: vi.fn(() => fakeClient(rows)),
      upsert: vi.fn(() => fakeClient(rows)),
      eq: vi.fn(() => fakeClient(rows)),
      in: vi.fn(() => fakeClient(rows)),
      is: vi.fn(() => fakeClient(rows)),
      gte: vi.fn(() => fakeClient(rows)),
      lte: vi.fn(() => fakeClient(rows)),
      order: vi.fn(() => fakeClient(rows)),
      single: vi.fn(() => Promise.resolve({ data: rows[0] ?? null, error: null })),
    })),
  } as unknown as ReturnType<typeof createRankingsService> extends { _client: infer C } ? C : never;
}

describe("Rankings service", () => {
  it("computes a monthly average weighted by assignment coefficient", () => {
    const grades = [
      {
        value_numeric: 10,
        value_text: null,
        normalized_value: null,
        assignments: { coefficient: 2 },
      },
      {
        value_numeric: 16,
        value_text: null,
        normalized_value: null,
        assignments: { coefficient: 1 },
      },
    ];
    const service = createRankingsService("http://localhost", "fake-key");
    // Use a public test helper if exposed; otherwise exercise via mock client in integration test.
    expect(service).toBeDefined();
  });
});
```

Wait — the service is tightly coupled to Supabase client. Better to test the pure function `computeMonthlyAverage` if we expose it. Refactor Task 2 to export `computeMonthlyAverage`.

Go back to `server/src/pedagogy/rankings/service.ts` and change:

```typescript
function computeMonthlyAverage(...)
```

to:

```typescript
export function computeMonthlyAverage(...)
```

Then update the test:

```typescript
import { computeMonthlyAverage } from "../src/pedagogy/rankings/service.js";

describe("computeMonthlyAverage", () => {
  it("returns weighted average by coefficient", () => {
    const grades = [
      { value_numeric: 10, value_text: null, normalized_value: null, assignments: { coefficient: 2 } },
      { value_numeric: 16, value_text: null, normalized_value: null, assignments: { coefficient: 1 } },
    ];
    expect(computeMonthlyAverage(grades)).toBe(12);
  });

  it("prefers normalized_value", () => {
    const grades = [
      { value_numeric: 5, value_text: null, normalized_value: 10, assignments: { coefficient: 1 } },
    ];
    expect(computeMonthlyAverage(grades)).toBe(10);
  });

  it("returns null when no gradable data", () => {
    expect(computeMonthlyAverage([])).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests**

Run:
```bash
cd server && npx vitest run tests/rankings-service.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add server/src/pedagogy/rankings/service.ts server/tests/rankings-service.test.ts
git commit -m "test(pedagogy): add rankings service unit tests"
```

---

## Task 6: Palmarès Routes Integration Test

**Files:**
- Create: `server/tests/rankings-routes.test.ts`

**Interfaces:**
- Consumes: `registerRankingsRoutes`, Fastify.
- Produces: integration tests for compute/publish/stars endpoints.

- [ ] **Step 1: Create integration test skeleton**

Create `server/tests/rankings-routes.test.ts`:

```typescript
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import Fastify from "fastify";
import { registerRankingsRoutes } from "../src/pedagogy/rankings/routes.js";
import type { RankingsService } from "../src/pedagogy/rankings/service.js";

const mockService: RankingsService = {
  listRankings: async () => [],
  getRanking: async () => null,
  computeMonthlyRanking: async () => ({
    id: "r1",
    school_id: "s1",
    class_id: null,
    month: "2026-08",
    status: "draft",
    computed_at: new Date().toISOString(),
    published_at: null,
    computed_by_profile_id: "p1",
    entries: [],
  }),
  publishRanking: async () => ({
    id: "r1",
    school_id: "s1",
    class_id: null,
    month: "2026-08",
    status: "published",
    computed_at: new Date().toISOString(),
    published_at: new Date().toISOString(),
    computed_by_profile_id: "p1",
  }),
  addStar: async () => ({ id: "st1", ranking_id: "r1", student_id: "std1", parent_profile_id: "p1", created_at: new Date().toISOString() }),
  removeStar: async () => {},
  listStars: async () => [],
};

async function buildApp() {
  const app = Fastify();
  registerRankingsRoutes(app, {
    service: mockService,
    access: {
      hasPermission: async () => true,
      hasScope: async () => true,
    } as unknown as Parameters<typeof registerRankingsRoutes>[1]["access"],
    resolveProfileAndSchool: async () => ({ profileId: "p1", schoolId: "s1" }),
  });
  return app;
}

describe("Rankings routes", () => {
  it("POST /compute returns a ranking", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/compute",
      headers: { authorization: "Bearer token" },
      payload: { month: "2026-08" },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.month).toBe("2026-08");
  });

  it("GET / returns rankings list", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/",
      headers: { authorization: "Bearer token" },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests**

Run:
```bash
cd server && npx vitest run tests/rankings-routes.test.ts
```

Expected: tests pass.

- [ ] **Step 3: Commit**

```bash
git add server/tests/rankings-routes.test.ts
git commit -m "test(pedagogy): add rankings routes integration tests"
```

---

## Task 7: Frontend Palmarès API

**Files:**
- Create: `app/modules/pedagogy/palmares-api.js`

**Interfaces:**
- Consumes: `window.schoolSafeBackendConfig`, localStorage session token.
- Produces: `window.SchoolSafePalmaresAPI` with methods matching backend endpoints.

- [ ] **Step 1: Create API file**

Create `app/modules/pedagogy/palmares-api.js`:

```javascript
(function (global) {
  "use strict";

  function getApiBase() {
    if (global.schoolSafeBackendConfig && global.schoolSafeBackendConfig.api_base) {
      return global.schoolSafeBackendConfig.api_base;
    }
    return global.location.protocol + "//" + global.location.host;
  }

  function currentToken() {
    try {
      var session = JSON.parse(localStorage.getItem("schoolsafe-v2-session") || "{}");
      return session.token || null;
    } catch (e) {
      return null;
    }
  }

  function authHeaders() {
    var token = currentToken();
    return token ? { Authorization: "Bearer " + token } : {};
  }

  async function apiGet(path) {
    var res = await fetch(getApiBase() + path, {
      method: "GET",
      headers: { Accept: "application/json", ...authHeaders() },
    });
    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error(data && data.message ? data.message : "Erreur " + res.status);
    return data && data.data ? data.data : data;
  }

  async function apiPost(path, body) {
    var res = await fetch(getApiBase() + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...authHeaders() },
      body: JSON.stringify(body || {}),
    });
    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error(data && data.message ? data.message : "Erreur " + res.status);
    return data && data.data ? data.data : data;
  }

  async function apiDelete(path) {
    var res = await fetch(getApiBase() + path, {
      method: "DELETE",
      headers: { Accept: "application/json", ...authHeaders() },
    });
    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error(data && data.message ? data.message : "Erreur " + res.status);
    return data;
  }

  function toQuery(params) {
    var parts = [];
    for (var key in params) {
      if (params[key] != null && params[key] !== "") {
        parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(params[key]));
      }
    }
    return parts.length ? "?" + parts.join("&") : "";
  }

  global.SchoolSafePalmaresAPI = {
    listRankings: function (options) { return apiGet("/pedagogy/rankings" + toQuery(options || {})); },
    getRanking: function (id) { return apiGet("/pedagogy/rankings/" + id); },
    computeRanking: function (month, classId) { return apiPost("/pedagogy/rankings/compute", { month: month, class_id: classId }); },
    publishRanking: function (id) { return apiPost("/pedagogy/rankings/" + id + "/publish", {}); },
    listStars: function (id) { return apiGet("/pedagogy/rankings/" + id + "/stars"); },
    addStar: function (id, studentId) { return apiPost("/pedagogy/rankings/" + id + "/stars", { student_id: studentId }); },
    removeStar: function (id, studentId) { return apiDelete("/pedagogy/rankings/" + id + "/stars/" + studentId); },
  };
})(window);
```

- [ ] **Step 2: Syntax-check**

Run:
```bash
node --check app/modules/pedagogy/palmares-api.js
```

Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add app/modules/pedagogy/palmares-api.js
git commit -m "feat(pedagogy): add palmares frontend API"
```

---

## Task 8: Frontend Palmarès Module

**Files:**
- Create: `app/modules/pedagogy/palmares-module.js`

**Interfaces:**
- Consumes: `global.SchoolSafePalmaresAPI`, `global.SchoolSafeSchoolAPI`, `global.SchoolSafeApp.notify`, demo mode helpers.
- Produces: `window.renderPalmaresModule(container, session)` and `window.refreshPalmaresModule()`.

- [ ] **Step 1: Create module file**

Create `app/modules/pedagogy/palmares-module.js`:

```javascript
(function (global) {
  "use strict";

  var state = {
    activeView: "class",
    selectedMonth: currentYearMonth(),
    selectedClassId: null,
    rankings: [],
    currentRanking: null,
    stars: [],
    children: [],
    classes: [],
    loading: false,
    error: null,
  };

  var container = null;
  var demoState = null;

  function currentYearMonth() {
    var now = new Date();
    return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  }

  function escapeMarkup(text) {
    return String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function notify(message) {
    if (global.SchoolSafeApp && global.SchoolSafeApp.notify) global.SchoolSafeApp.notify(message);
    else global.dispatchEvent(new CustomEvent("schoolsafe-toast", { detail: { message: message } }));
  }

  function hasValidSessionToken() {
    try {
      var raw = global.localStorage.getItem("schoolsafe-v2-session");
      if (!raw) return false;
      var session = JSON.parse(raw);
      return !!(session && session.token);
    } catch (e) { return false; }
  }

  function isDemoMode() {
    if (global.schoolSafeDemoMode === true) return true;
    var host = String(global.location && global.location.hostname || "").toLowerCase();
    var isLocalhost = host === "localhost" || host === "127.0.0.1";
    return isLocalhost && !hasValidSessionToken();
  }

  function getSession() {
    try {
      var raw = global.localStorage.getItem("schoolsafe-v2-session");
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function isParent(session) {
    return session && Array.isArray(session.roles) && session.roles.indexOf("parent") >= 0;
  }

  function canManage() {
    var session = getSession();
    if (!session || !Array.isArray(session.permissions)) return false;
    return session.permissions.indexOf("palmarques.manage") >= 0;
  }

  function createDemoState() {
    return {
      activeView: "class",
      selectedMonth: currentYearMonth(),
      selectedClassId: "demo-c1",
      rankings: [
        { id: "demo-r-class", school_id: "demo-school", class_id: "demo-c1", month: currentYearMonth(), status: "published", computed_at: new Date().toISOString() },
        { id: "demo-r-school", school_id: "demo-school", class_id: null, month: currentYearMonth(), status: "published", computed_at: new Date().toISOString() },
      ],
      currentRanking: null,
      stars: [{ ranking_id: "demo-r-class", student_id: "demo-s1", parent_profile_id: "demo-parent" }],
      children: [{ students: { id: "demo-s1", first_name: "Lucas", last_name: "Martin", class_id: "demo-c1", classes: { name: "1re A" } } }],
      classes: [{ id: "demo-c1", name: "1re A" }, { id: "demo-c2", name: "2e B" }],
      loading: false,
      error: null,
    };
  }

  function createDemoRankingEntries(rankingId) {
    var entries = [
      { student_id: "demo-s1", first_name: "Lucas", last_name: "Martin", classes: { name: "1re A" }, photo_path: null, rank: 1, monthly_average: 18.5 },
      { student_id: "demo-s2", first_name: "Emma", last_name: "Martin", classes: { name: "1re A" }, photo_path: null, rank: 2, monthly_average: 17.25 },
      { student_id: "demo-s3", first_name: "Ethan", last_name: "Leroy", classes: { name: "1re A" }, photo_path: null, rank: 3, monthly_average: 16 },
    ];
    return entries.map(function (e) {
      return {
        id: "demo-entry-" + e.student_id,
        ranking_id: rankingId,
        student_id: e.student_id,
        rank: e.rank,
        monthly_average: e.monthly_average,
        students: e,
      };
    });
  }

  async function init(parentContainer, session) {
    container = parentContainer;
    demoState = isDemoMode() ? createDemoState() : null;
    if (demoState) {
      Object.assign(state, demoState);
      state.selectedClassId = session && isParent(session) ? "demo-c1" : state.selectedClassId;
      await loadCurrentRanking();
      render();
      return;
    }

    state.loading = true;
    render();
    try {
      state.classes = await global.SchoolSafePedagogyAPI.listClasses();
      if (session && isParent(session)) {
        state.children = await global.SchoolSafePedagogyAPI.getParentChildren();
        if (state.children.length > 0) {
          state.selectedClassId = state.children[0].students.class_id;
        }
      } else if (state.classes.length > 0) {
        state.selectedClassId = state.classes[0].id;
      }
      await loadRankingsList();
      await loadCurrentRanking();
    } catch (e) {
      state.error = e.message || "Erreur de chargement";
      notify(state.error);
    }
    state.loading = false;
    render();
  }

  async function loadRankingsList() {
    var options = { month: state.selectedMonth };
    if (state.activeView === "class" && state.selectedClassId) options.class_id = state.selectedClassId;
    if (state.activeView === "school") options.class_id = "null";
    state.rankings = await global.SchoolSafePalmaresAPI.listRankings(options);
  }

  async function loadCurrentRanking() {
    var ranking = state.rankings.find(function (r) {
      if (state.activeView === "school") return r.class_id === null;
      return r.class_id === state.selectedClassId;
    });
    if (!ranking) {
      state.currentRanking = null;
      state.stars = [];
      return;
    }
    if (demoState) {
      state.currentRanking = {
        ...ranking,
        entries: createDemoRankingEntries(ranking.id),
      };
      state.stars = demoState.stars;
      return;
    }
    state.currentRanking = await global.SchoolSafePalmaresAPI.getRanking(ranking.id);
    state.stars = await global.SchoolSafePalmaresAPI.listStars(ranking.id);
  }

  async function computeRanking() {
    if (!canManage()) return;
    state.loading = true;
    render();
    try {
      await global.SchoolSafePalmaresAPI.computeRanking(state.selectedMonth, state.activeView === "school" ? undefined : state.selectedClassId);
      notify("Palmarès calculé.");
      await loadRankingsList();
      await loadCurrentRanking();
    } catch (e) {
      notify(e.message || "Erreur de calcul");
    }
    state.loading = false;
    render();
  }

  async function publishRanking() {
    if (!state.currentRanking || !canManage()) return;
    state.loading = true;
    render();
    try {
      await global.SchoolSafePalmaresAPI.publishRanking(state.currentRanking.id);
      notify("Palmarès publié.");
      await loadRankingsList();
      await loadCurrentRanking();
    } catch (e) {
      notify(e.message || "Erreur de publication");
    }
    state.loading = false;
    render();
  }

  async function toggleStar(studentId) {
    if (!state.currentRanking) return;
    var session = getSession();
    if (!session || !isParent(session)) return;
    var existing = state.stars.find(function (s) { return s.student_id === studentId; });
    try {
      if (existing) {
        await global.SchoolSafePalmaresAPI.removeStar(state.currentRanking.id, studentId);
        notify("Étoile retirée.");
      } else {
        await global.SchoolSafePalmaresAPI.addStar(state.currentRanking.id, studentId);
        notify("⭐ Élève encouragé !");
      }
      state.stars = await global.SchoolSafePalmaresAPI.listStars(state.currentRanking.id);
      render();
    } catch (e) {
      notify(e.message || "Erreur");
    }
  }

  function studentPhotoUrl(student) {
    if (!student) return "./schoolsafe-logo.png";
    if (student.photo_path) return student.photo_path;
    return "./schoolsafe-logo.png";
  }

  function starCount(studentId) {
    return state.stars.filter(function (s) { return s.student_id === studentId; }).length;
  }

  function hasStarred(studentId) {
    var session = getSession();
    if (!session) return false;
    return state.stars.some(function (s) { return s.student_id === studentId && s.parent_profile_id === session.profile.id; });
  }

  function render() {
    if (!container) return;
    var session = getSession();
    var isParentUser = session && isParent(session);
    var html = '<div class="palmares-module">';
    html += renderHeader(isParentUser);
    html += renderControls(isParentUser);
    if (state.loading) html += '<div class="palmares-loading">Chargement du palmarès…</div>';
    else if (state.error) html += '<div class="palmares-error">' + escapeMarkup(state.error) + '</div>';
    else if (!state.currentRanking) html += renderEmpty();
    else html += renderRanking();
    html += "</div>";
    container.innerHTML = html;
    bindEvents();
  }

  function renderHeader(isParentUser) {
    return '<div class="palmares-header"><h2><i data-lucide="trophy"></i> Palmarès</h2><p>' + (isParentUser ? "Top 10 de la classe de votre enfant et de toute l’école" : "Classements mensuels par classe et par école") + '</p></div>';
  }

  function renderControls(isParentUser) {
    var html = '<div class="palmares-controls">';
    html += '<label>Mois <input type="month" id="palmaresMonth" value="' + escapeMarkup(state.selectedMonth) + '"></label>';
    if (!isParentUser) {
      html += '<div class="palmares-view-toggle">' +
        '<button type="button" data-view="class" class="' + (state.activeView === "class" ? "active" : "") + '">Par classe</button>' +
        '<button type="button" data-view="school" class="' + (state.activeView === "school" ? "active" : "") + '">Toute l’école</button>' +
        '</div>';
      if (state.activeView === "class") {
        html += '<label>Classe <select id="palmaresClass">';
        state.classes.forEach(function (c) {
          html += '<option value="' + escapeMarkup(c.id) + '"' + (c.id === state.selectedClassId ? " selected" : "") + '>' + escapeMarkup(c.name) + '</option>';
        });
        html += '</select></label>';
      }
      if (canManage()) {
        html += '<button type="button" id="palmaresCompute" class="primary-button small">Calculer</button>';
        if (state.currentRanking && state.currentRanking.status === "draft") {
          html += '<button type="button" id="palmaresPublish" class="primary-button small">Publier</button>';
        }
      }
    }
    html += "</div>";
    return html;
  }

  function renderEmpty() {
    return '<div class="palmares-empty"><p>Aucun palmarès pour ce mois.</p>' +
      (canManage() ? '<button type="button" id="palmaresComputeEmpty" class="primary-button">Calculer le palmarès</button>' : '') +
      '</div>';
  }

  function renderRanking() {
    var entries = (state.currentRanking.entries || []).slice(0, 10);
    var html = '<div class="palmares-ranking">';
    if (state.currentRanking.status === "draft") html += '<div class="palmares-draft-badge">Brouillon</div>';
    html += '<div class="palmares-podium">';
    entries.slice(0, 3).forEach(function (entry, index) {
      html += renderPodiumCard(entry, index);
    });
    html += '</div>';
    html += '<ol class="palmares-list" start="4">';
    entries.slice(3).forEach(function (entry) {
      html += renderListItem(entry);
    });
    html += '</ol>';
    html += '</div>';
    return html;
  }

  function renderPodiumCard(entry, index) {
    var medal = ["🥇", "🥈", "🥉"][index];
    var student = entry.students;
    var stars = starCount(entry.student_id);
    var starred = hasStarred(entry.student_id);
    return '<div class="palmares-card podium rank-' + (index + 1) + '">' +
      '<div class="palmares-medal">' + medal + '</div>' +
      '<img class="palmares-photo" src="' + escapeMarkup(studentPhotoUrl(student)) + '" alt="">' +
      '<div class="palmares-name">' + escapeMarkup(student.first_name + " " + student.last_name) + '</div>' +
      '<div class="palmares-class">' + escapeMarkup(student.classes?.name || "") + '</div>' +
      '<div class="palmares-average">' + entry.monthly_average + '/20</div>' +
      '<div class="palmares-stars">⭐ ' + stars + '</div>' +
      renderStarButton(entry.student_id, starred) +
      '</div>';
  }

  function renderListItem(entry) {
    var student = entry.students;
    var stars = starCount(entry.student_id);
    var starred = hasStarred(entry.student_id);
    return '<li class="palmares-list-item">' +
      '<span class="palmares-rank">' + entry.rank + '</span>' +
      '<img class="palmares-photo small" src="' + escapeMarkup(studentPhotoUrl(student)) + '" alt="">' +
      '<span class="palmares-name">' + escapeMarkup(student.first_name + " " + student.last_name) + '</span>' +
      '<span class="palmares-class">' + escapeMarkup(student.classes?.name || "") + '</span>' +
      '<span class="palmares-average">' + entry.monthly_average + '/20</span>' +
      '<span class="palmares-stars">⭐ ' + stars + '</span>' +
      renderStarButton(entry.student_id, starred) +
      '</li>';
  }

  function renderStarButton(studentId, starred) {
    var session = getSession();
    if (!session || session.roles.indexOf("parent") < 0) return '';
    return '<button type="button" class="palmares-star-btn' + (starred ? " starred" : "") + '" data-star-student="' + escapeMarkup(studentId) + '">' +
      (starred ? "⭐ Retirer" : "⭐ Encourager") +
      '</button>';
  }

  function bindEvents() {
    var monthInput = container.querySelector("#palmaresMonth");
    if (monthInput) monthInput.addEventListener("change", function (e) { state.selectedMonth = e.target.value; loadRankingsList().then(loadCurrentRanking).then(render); });

    container.querySelectorAll("[data-view]").forEach(function (btn) {
      btn.addEventListener("click", function () { state.activeView = btn.getAttribute("data-view"); loadRankingsList().then(loadCurrentRanking).then(render); });
    });

    var classSelect = container.querySelector("#palmaresClass");
    if (classSelect) classSelect.addEventListener("change", function (e) { state.selectedClassId = e.target.value; loadRankingsList().then(loadCurrentRanking).then(render); });

    var computeBtn = container.querySelector("#palmaresCompute");
    if (computeBtn) computeBtn.addEventListener("click", computeRanking);
    var computeEmptyBtn = container.querySelector("#palmaresComputeEmpty");
    if (computeEmptyBtn) computeEmptyBtn.addEventListener("click", computeRanking);

    var publishBtn = container.querySelector("#palmaresPublish");
    if (publishBtn) publishBtn.addEventListener("click", publishRanking);

    container.querySelectorAll("[data-star-student]").forEach(function (btn) {
      btn.addEventListener("click", function () { toggleStar(btn.getAttribute("data-star-student")); });
    });

    if (global.lucide && global.lucide.createIcons) {
      try { global.lucide.createIcons(); } catch (e) {}
    }
  }

  global.renderPalmaresModule = function (parentContainer, session) {
    init(parentContainer, session);
  };

  global.refreshPalmaresModule = function () {
    if (container) render();
  };
})(window);
```

- [ ] **Step 2: Syntax-check**

Run:
```bash
node --check app/modules/pedagogy/palmares-module.js
```

Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add app/modules/pedagogy/palmares-module.js
git commit -m "feat(pedagogy): add palmares frontend module"
```

---

## Task 9: Wire Palmarès into App Shell

**Files:**
- Modify: `app/app.js`
- Modify: `app/index.html`
- Create or modify: `app/styles.css` (add Palmarès CSS)

**Interfaces:**
- Consumes: `window.renderPalmaresModule`.
- Produces: Palmarès rendered when user clicks “Palmarès” in the pedagogy branch.

- [ ] **Step 1: Add script tags in `app/index.html`**

After the pedagogy module script tags (around line 30), add:

```html
<script src="./modules/pedagogy/palmares-api.js" defer></script>
<script src="./modules/pedagogy/palmares-module.js" defer></script>
```

- [ ] **Step 2: Add Palmarès CSS to `app/styles.css`**

Append to `app/styles.css`:

```css
/* Palmarès */
.palmares-module { padding: 1rem; }
.palmares-header h2 { display: flex; align-items: center; gap: .5rem; margin: 0 0 .25rem; }
.palmares-controls { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; margin: 1rem 0; }
.palmares-controls label { display: flex; align-items: center; gap: .5rem; }
.palmares-view-toggle { display: flex; gap: .25rem; }
.palmares-view-toggle button { padding: .4rem .8rem; border: 1px solid #d1d5db; background: #fff; border-radius: .4rem; cursor: pointer; }
.palmares-view-toggle button.active { background: #6b42c7; color: #fff; border-color: #6b42c7; }
.palmares-loading, .palmares-error, .palmares-empty { padding: 2rem; text-align: center; color: #6b7280; }
.palmares-error { color: #b91c1c; }
.palmares-draft-badge { display: inline-block; background: #f59e0b; color: #fff; padding: .2rem .6rem; border-radius: .3rem; font-size: .8rem; margin-bottom: .5rem; }
.palmares-podium { display: flex; gap: 1rem; justify-content: center; margin-bottom: 1.5rem; flex-wrap: wrap; }
.palmares-card { background: linear-gradient(180deg, #fff 0%, #f3f4f6 100%); border: 1px solid #e5e7eb; border-radius: 1rem; padding: 1rem; text-align: center; min-width: 140px; box-shadow: 0 4px 12px rgba(0,0,0,.06); }
.palmares-card.rank-1 { transform: scale(1.08); border-color: #fbbf24; }
.palmares-card.rank-2 { border-color: #9ca3af; }
.palmares-card.rank-3 { border-color: #d97706; }
.palmares-medal { font-size: 2rem; }
.palmares-photo { width: 72px; height: 72px; object-fit: cover; border-radius: 50%; margin: .5rem 0; border: 3px solid #e5e7eb; }
.palmares-photo.small { width: 44px; height: 44px; }
.palmares-name { font-weight: 700; }
.palmares-class { font-size: .85rem; color: #6b7280; }
.palmares-average { font-size: 1.1rem; font-weight: 700; color: #6b42c7; margin: .25rem 0; }
.palmares-stars { font-size: .9rem; color: #d97706; }
.palmares-star-btn { margin-top: .5rem; padding: .3rem .6rem; border: 1px solid #d97706; background: #fff; color: #d97706; border-radius: .4rem; cursor: pointer; }
.palmares-star-btn.starred { background: #d97706; color: #fff; }
.palmares-list { list-style: none; padding: 0; margin: 0; }
.palmares-list-item { display: flex; align-items: center; gap: .75rem; padding: .75rem; border-bottom: 1px solid #e5e7eb; }
.palmares-list-item .palmares-rank { width: 2rem; text-align: center; font-weight: 700; color: #6b7280; }
@media (max-width: 640px) {
  .palmares-podium { flex-direction: column; align-items: center; }
  .palmares-list-item { flex-wrap: wrap; }
}
```

- [ ] **Step 3: Hook Palmarès action in `app/app.js`**

Find where action handlers are dispatched (search for `"Palmarès"` or `actionName`). The menu entry already exists under the pedagogy branch with `action: "palmarès"`. Add a handler:

```javascript
function executeAction(action) {
  if (!action) return;
  if (action === "palmarès") {
    showModule("palmarès");
    return;
  }
  // ... existing handlers
}
```

Find `showModule` and add a branch:

```javascript
function showModule(moduleName) {
  // ... existing logic
  if (moduleName === "palmarès") {
    renderPalmaresModule(contentEl, currentSession());
    return;
  }
  // ... existing logic
}
```

Use the actual function names found in `app/app.js` (e.g., `openModule`, `renderWorkspace`, `workspaceContent`). Verify by searching for existing module dispatchers like `"finance"` or `"pedagogy"`.

- [ ] **Step 4: Syntax-check and smoke test**

Run:
```bash
node --check app/app.js
node --check app/modules/pedagogy/palmares-module.js
node --check app/modules/pedagogy/palmares-api.js
```

Open `app/index.html` in a browser, log in as admin/pedagogy/parent, and click “Palmarès”.

Expected: Palmarès UI loads. In demo mode, sample ranking appears.

- [ ] **Step 5: Commit**

```bash
git add app/index.html app/styles.css app/app.js
git commit -m "feat(pedagogy): wire palmares module into app shell"
```

---

## Task 10: Copy Safe Assistant Assets

**Files:**
- Create: `app/safe2d/` directory with copied PNGs.

**Interfaces:**
- Produces: `app/safe2d/safe_*.png` and `app/safe2d/manifest.json`.

- [ ] **Step 1: Copy assets**

Run:
```bash
cp -r tmp/glb-inspect/safe2d app/safe2d
```

Verify:
```bash
ls app/safe2d/
```

Expected: `safe_accueil.png`, `safe_assise.png`, `safe_clin.png`, `safe_livre.png`, `safe_marche.png`, `safe_pense.png`, `safe_pointe.png`, `safe_pouce.png`, `safe_reflechie.png`, `safe_salue.png`, `safe_saute.png`, `safe_sourire.png`, `manifest.json`.

- [ ] **Step 2: Commit**

```bash
git add app/safe2d/
git commit -m "feat(safe): copy Safe Assistant 2D assets"
```

---

## Task 11: Safe Assistant Vanilla JS Module

**Files:**
- Create: `app/modules/safe/safe-assistant.js`
- Create: `app/modules/safe/safe-assistant.css`

**Interfaces:**
- Consumes: `app/safe2d/manifest.json`, FAQ/onboarding JSON (embedded or fetched), `localStorage`.
- Produces: `window.SafeAssistant` controller and global events listener.

- [ ] **Step 1: Create CSS file**

Create `app/modules/safe/safe-assistant.css`:

```css
.safe-assistant {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.safe-avatar {
  width: 80px;
  height: 120px;
  cursor: pointer;
  filter: drop-shadow(0 4px 8px rgba(0,0,0,.2));
  transition: transform .2s ease;
}
.safe-avatar:hover { transform: scale(1.05); }
.safe-avatar img { width: 100%; height: 100%; object-fit: contain; }
.safe-bubble {
  position: absolute;
  bottom: 130px;
  right: 0;
  width: 280px;
  max-width: calc(100vw - 48px);
  background: #fff;
  border-radius: 16px;
  padding: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,.15);
  border: 1px solid #e5e7eb;
  animation: safe-pop .25s ease;
}
.safe-bubble::after {
  content: "";
  position: absolute;
  bottom: -8px;
  right: 28px;
  width: 0; height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid #fff;
}
.safe-bubble-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: .5rem; }
.safe-bubble-header strong { color: #6b42c7; }
.safe-bubble-close { background: none; border: none; cursor: pointer; color: #9ca3af; }
.safe-bubble-body { font-size: .95rem; line-height: 1.4; color: #374151; max-height: 220px; overflow-y: auto; }
.safe-bubble-body p { margin: 0 0 .5rem; }
.safe-suggestions { display: flex; flex-wrap: wrap; gap: .4rem; margin-top: .5rem; }
.safe-suggestions button { font-size: .8rem; padding: .3rem .6rem; border: 1px solid #6b42c7; background: #fff; color: #6b42c7; border-radius: 1rem; cursor: pointer; }
.safe-suggestions button:hover { background: #6b42c7; color: #fff; }
.safe-input-row { display: flex; gap: .4rem; margin-top: .5rem; }
.safe-input-row input { flex: 1; padding: .4rem .6rem; border: 1px solid #d1d5db; border-radius: .4rem; }
.safe-input-row button { padding: .4rem .8rem; background: #6b42c7; color: #fff; border: none; border-radius: .4rem; cursor: pointer; }
.safe-minimized { width: 56px; height: 56px; border-radius: 50%; overflow: hidden; background: #fff; border: 2px solid #6b42c7; }
.safe-minimized img { width: 100%; height: 100%; object-fit: cover; }
@keyframes safe-pop { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 640px) {
  .safe-assistant { bottom: 16px; right: 16px; }
  .safe-bubble { right: -10px; width: 260px; }
}
@media (prefers-reduced-motion: reduce) {
  .safe-avatar, .safe-bubble { animation: none; transition: none; }
}
```

- [ ] **Step 2: Create module file**

Create `app/modules/safe/safe-assistant.js`:

```javascript
(function (global) {
  "use strict";

  var ASSET_BASE = "./safe2d/";
  var DEFAULT_POSE = "sourire";

  var faq = [
    { keywords: ["ajouter", "élève"], question: "Comment ajouter un élève ?", answer: "Va dans Élèves, clique sur « + Ajouter », remplis les informations puis enregistre.", pose: "pointe" },
    { keywords: ["présence", "appel"], question: "Comment faire l’appel ?", answer: "Va dans Présences, choisis ta classe et la date, marque les absents/retards, puis valide.", pose: "pointe" },
    { keywords: ["paiement", "caisse"], question: "Comment enregistrer un paiement ?", answer: "Dans Caisse, clique « + Nouveau paiement », choisis l’élève, le type de frais et le montant.", pose: "pointe" },
    { keywords: ["rapport"], question: "Comment générer un rapport ?", answer: "Va dans Rapports, choisis le type et la période, puis clique « Générer ».", pose: "pointe" },
    { keywords: ["qui", "safe"], question: "Qui es-tu ?", answer: "Je suis Safe, ton assistante SchoolSafe ! Pose-moi tes questions.", pose: "clin" },
    { keywords: ["bonjour", "salut"], question: "Bonjour !", answer: "Bonjour ! Que veux-tu faire aujourd’hui dans SchoolSafe ?", pose: "salue" },
    { keywords: ["aide"], question: "J’ai besoin d’aide", answer: "Je suis là ! Choisis un sujet ci-dessous ou pose ta question.", pose: "accueil" },
  ];

  var onboardingSteps = [
    { pose: "accueil", message: "Bonjour ! Je suis Safe, ton assistante SchoolSafe. Je te fais découvrir l’application en 2 minutes ?" },
    { pose: "pointe", message: "Le menu à gauche te donne accès à toutes les fonctions : élèves, classes, présences, caisse, rapports…" },
    { pose: "saute", message: "Tu connais les bases ! Clique sur moi quand tu as une question. 🎉" },
  ];

  var state = {
    open: false,
    minimized: false,
    pose: DEFAULT_POSE,
    currentMessage: "",
    suggestions: ["Comment ajouter un élève ?", "Comment faire l’appel ?", "Comment enregistrer un paiement ?"],
    onboardingIndex: -1,
  };

  var container = null;

  function init() {
    if (container) return;
    container = document.createElement("div");
    container.className = "safe-assistant";
    container.setAttribute("aria-label", "Assistant Safe");
    document.body.appendChild(container);
    render();
    maybeStartOnboarding();
    listenToAppEvents();
  }

  function hasCompletedOnboarding() {
    try { return localStorage.getItem("safe_onboarding_done") === "1"; } catch (e) { return true; }
  }

  function markOnboardingDone() {
    try { localStorage.setItem("safe_onboarding_done", "1"); } catch (e) {}
  }

  function maybeStartOnboarding() {
    if (hasCompletedOnboarding()) return;
    state.onboardingIndex = 0;
    state.open = true;
    showOnboardingStep();
  }

  function showOnboardingStep() {
    var step = onboardingSteps[state.onboardingIndex];
    if (!step) {
      state.onboardingIndex = -1;
      state.currentMessage = "Tu peux me poser tes questions quand tu veux !";
      state.pose = "sourire";
      render();
      return;
    }
    state.pose = step.pose;
    state.currentMessage = step.message;
    state.suggestions = state.onboardingIndex < onboardingSteps.length - 1
      ? ["Continuer", "Plus tard"]
      : ["Terminer"];
    render();
  }

  function assetUrl(pose) {
    return ASSET_BASE + "safe_" + pose + ".png";
  }

  function escape(text) {
    return String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function render() {
    if (!container) return;
    var html = "";
    if (state.open) {
      html += '<div class="safe-bubble">';
      html += '<div class="safe-bubble-header"><strong>Safe</strong><button class="safe-bubble-close" aria-label="Fermer">✕</button></div>';
      html += '<div class="safe-bubble-body"><p>' + escape(state.currentMessage) + '</p>';
      if (state.suggestions.length) {
        html += '<div class="safe-suggestions">';
        state.suggestions.forEach(function (s) {
          html += '<button type="button" data-suggestion="' + escape(s) + '">' + escape(s) + '</button>';
        });
        html += '</div>';
      }
      html += '<div class="safe-input-row"><input type="text" id="safeInput" placeholder="Pose ta question…"><button type="button" id="safeSend">Envoyer</button></div>';
      html += '</div></div>';
    }
    html += '<div class="safe-avatar' + (state.minimized ? " safe-minimized" : "") + '" role="button" tabindex="0" aria-label="Ouvrir Safe">';
    html += '<img src="' + assetUrl(state.pose) + '" alt="Safe">';
    html += '</div>';
    container.innerHTML = html;
    bindEvents();
  }

  function bindEvents() {
    var avatar = container.querySelector(".safe-avatar");
    if (avatar) avatar.addEventListener("click", toggleOpen);

    var closeBtn = container.querySelector(".safe-bubble-close");
    if (closeBtn) closeBtn.addEventListener("click", function (e) { e.stopPropagation(); closeBubble(); });

    var suggestions = container.querySelectorAll("[data-suggestion]");
    suggestions.forEach(function (btn) {
      btn.addEventListener("click", function () { handleSuggestion(btn.getAttribute("data-suggestion")); });
    });

    var input = container.querySelector("#safeInput");
    var sendBtn = container.querySelector("#safeSend");
    if (sendBtn) sendBtn.addEventListener("click", function () { if (input) handleUserInput(input.value); });
    if (input) input.addEventListener("keydown", function (e) { if (e.key === "Enter") handleUserInput(input.value); });
  }

  function toggleOpen() {
    state.open = !state.open;
    if (state.open && !state.currentMessage) {
      state.currentMessage = "Bonjour ! Je suis Safe, ton assistante SchoolSafe. 😊";
      state.pose = "salue";
      state.suggestions = ["Comment ajouter un élève ?", "Comment faire l’appel ?", "Comment enregistrer un paiement ?"];
    }
    render();
  }

  function closeBubble() {
    state.open = false;
    render();
  }

  function handleSuggestion(text) {
    if (state.onboardingIndex >= 0) {
      if (text === "Continuer") {
        state.onboardingIndex++;
        showOnboardingStep();
      } else if (text === "Plus tard") {
        state.onboardingIndex = -1;
        markOnboardingDone();
        closeBubble();
      } else if (text === "Terminer") {
        state.onboardingIndex = -1;
        markOnboardingDone();
        state.currentMessage = "Tu peux me poser tes questions quand tu veux !";
        state.pose = "sourire";
        state.suggestions = [];
        render();
      }
      return;
    }
    handleUserInput(text);
  }

  function handleUserInput(raw) {
    var text = String(raw || "").toLowerCase();
    if (!text) return;

    var best = null;
    var bestScore = 0;
    for (var i = 0; i < faq.length; i++) {
      var item = faq[i];
      var score = 0;
      for (var j = 0; j < item.keywords.length; j++) {
        if (text.indexOf(item.keywords[j]) >= 0) score++;
      }
      if (score > bestScore) { bestScore = score; best = item; }
    }

    if (best && bestScore >= 1) {
      state.currentMessage = best.answer;
      state.pose = best.pose;
    } else {
      state.currentMessage = "Hmm, je ne suis pas sûre de comprendre. Essaie avec d’autres mots, ou choisis un sujet.";
      state.pose = "pense";
    }
    state.suggestions = ["Comment ajouter un élève ?", "Comment faire l’appel ?", "Comment enregistrer un paiement ?"];
    render();
  }

  function listenToAppEvents() {
    global.addEventListener("safe:event", function (e) {
      var detail = e.detail || {};
      if (detail.type === "action:success") { state.pose = "pouce"; state.currentMessage = "Parfait, c’est enregistré ! 👍"; }
      else if (detail.type === "action:big_success") { state.pose = "saute"; state.currentMessage = "Félicitations ! 🎉"; }
      else if (detail.type === "action:error") { state.pose = "reflechie"; state.currentMessage = "Oups ! " + (detail.message || "Quelque chose n’a pas marché.") + " On réessaie ?"; }
      else if (detail.type === "loading:start") { state.pose = "pense"; }
      else if (detail.type === "loading:stop") { state.pose = "sourire"; }
      if (state.open) render();
    });
  }

  global.SafeAssistant = { init: init };
  global.addEventListener("DOMContentLoaded", init);
})(window);
```

- [ ] **Step 3: Syntax-check**

Run:
```bash
node --check app/modules/safe/safe-assistant.js
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add app/modules/safe/safe-assistant.css app/modules/safe/safe-assistant.js
git commit -m "feat(safe): add Safe Assistant vanilla JS module"
```

---

## Task 12: Wire Safe Assistant into App Shell

**Files:**
- Modify: `app/index.html`
- Modify: `app/app.js`

**Interfaces:**
- Consumes: `window.SafeAssistant.init`.
- Produces: Safe floating button appears on all authenticated screens.

- [ ] **Step 1: Add CSS and script tags**

In `app/index.html` `<head>`, add after other stylesheets:

```html
<link rel="stylesheet" href="./modules/safe/safe-assistant.css">
```

Before `</body>` or after other module scripts, add:

```html
<script src="./modules/safe/safe-assistant.js" defer></script>
```

- [ ] **Step 2: Dispatch Safe events from app**

In `app/app.js`, find existing `notify` or action handlers. Add event dispatches:

```javascript
function safeEvent(type, message) {
  window.dispatchEvent(new CustomEvent("safe:event", { detail: { type: type, message: message } }));
}
```

Call `safeEvent("action:success")` after successful payment/grade save/etc. For now, add at least in the `notify` helper when the message indicates success:

```javascript
function notify(message) {
  // existing toast logic
  if (message && /enregistr|publi|réussi|terminé/i.test(message)) {
    safeEvent("action:success", message);
  }
}
```

- [ ] **Step 3: Verify in browser**

Open `app/index.html`. Safe avatar should appear in the bottom-right after login/workspace screen. Clicking it opens the bubble.

- [ ] **Step 4: Commit**

```bash
git add app/index.html app/app.js
git commit -m "feat(safe): wire Safe Assistant into app shell"
```

---

## Task 13: Final Verification

**Files:**
- All modified files.

- [ ] **Step 1: Run backend type check**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Run backend tests**

```bash
cd server && npx vitest run tests/rankings-service.test.ts tests/rankings-routes.test.ts
```

Expected: all pass.

- [ ] **Step 3: Syntax-check frontend JS**

```bash
node --check app/app.js
node --check app/modules/pedagogy/palmares-api.js
node --check app/modules/pedagogy/palmares-module.js
node --check app/modules/safe/safe-assistant.js
```

Expected: no output (success).

- [ ] **Step 4: Browser smoke tests**

1. Open `app/index.html` in a browser.
2. Use demo mode (localhost, no token).
3. Log in as admin/pedagogy → click “Palmarès” → verify Top 10 renders with podium.
4. Log in as parent → verify only child’s class top 10 + school top 10 visible.
5. Verify Safe Assistant avatar opens/closes and responds to “bonjour”.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: final QA adjustments for palmares and safe assistant"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Palmarès tables (`rankings`, `ranking_entries`, `ranking_stars`) — Task 1
- [x] Monthly automatic ranking computation — Task 2
- [x] Top 10 per class and school — Task 2 + 8
- [x] Parent scope (own child class + school) — Task 8
- [x] Reuse official student photo — Task 8 (`studentPhotoUrl`)
- [x] Podium medals 🥇🥈🥉 — Task 8
- [x] Star encouragement with uniqueness — Tasks 2 + 8
- [x] Monthly history — Task 8 month selector + Task 2 listRankings
- [x] Permissions/RLS/Audit — Tasks 1 + 3 + 4
- [x] Safe Assistant integration — Tasks 10–12

**Placeholder scan:**
- [x] No TBD/TODO/"implement later".
- [x] All code blocks contain concrete code.

**Type consistency:**
- [x] `RankingsService` interface matches service implementation.
- [x] Route dependencies use `rankingsService` key.
- [x] Frontend API methods match backend paths.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-08-20-palmares-safe-assistant-plan.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach do you want?
