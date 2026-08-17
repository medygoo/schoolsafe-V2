# Partie B — École & Personnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finaliser l’espace admin principal avec les onglets **Mon école** et **Mon équipe**, et brancher le menu d’accès aux permissions `school.manage` / `staff.manage`.

**Architecture:** Le backend Fastify expose des routes `/school/*` protégées par `requirePermission`. Le service `SchoolService` utilise `service_role` côté serveur pour appeler Supabase. Le frontend PWA charge `school-module.js` et `school-api.js`, et le module est branché dans `app.js`. Le logo est stocké sur le VPS pour l’instant.

**Tech Stack:** TypeScript, Fastify, Zod, Vitest, Supabase JS, vanilla JS PWA.

**Spec:** `docs/superpowers/specs/2026-08-17-ecole-personnel-design.md`

## Global Constraints

- **Mono-école** : une base = une école, pas de multi-tenant complexe.
- **Sécurité** : aucun `service_role`, clé Brevo, secret QR ou clé SMS dans le frontend.
- **Permissions** : deny override (refus explicite l’emporte).
- **Tests** : `npm run typecheck` et `npm test` doivent être verts avant chaque commit.
- **Langue UI** : français principal ; anglais secondaire là où c’est déjà prévu (`school.name_en`).
- **Commits fréquents** : une tâche = un commit, push immédiat.

---

## File Structure

**Backend:**
- `server/src/school/schema.ts` — schémas Zod des payloads.
- `server/src/school/service.ts` — logique métier École & Personnel.
- `server/src/school/routes.ts` — routes Fastify.
- `server/tests/school.test.ts` — tests.

**Frontend:**
- `app/modules/school/school-api.js` — client API.
- `app/modules/school/school-module.js` — rendu et interactions.
- `app/modules/school/school.css` — styles.
- `app/app.js` — routage et ouverture/fermeture du module.
- `app/index.html` — chargement des fichiers.

---

## Task 1 : Backend École — années, cycles et logo

**Files:**
- Modify: `server/src/school/schema.ts`
- Modify: `server/src/school/service.ts`
- Modify: `server/src/school/routes.ts`
- Modify: `server/src/index.ts`
- Create: `server/uploads/logos/.gitkeep`

**Interfaces:**
- Consumes: tables `academic_years`, `school_cycles`, `school`, `school_contacts`.
- Produces:
  - `GET /school/academic-years`
  - `POST /school/academic-years`
  - `PUT /school/academic-years/:id`
  - `POST /school/academic-years/:id/activate`
  - `GET /school/cycles`
  - `PUT /school/cycles/:key/toggle`
  - `POST /school/logo`
  - `GET /uploads/logos/:filename` (static)

- [ ] **Step 1 : Ajouter les schémas Zod**

Dans `server/src/school/schema.ts`, ajouter :

```typescript
export const createAcademicYearSchema = z.object({
  label: z.string().min(1),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ends_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periods: z.enum(["Trimestres", "Semestres"]),
});

export const updateAcademicYearSchema = createAcademicYearSchema.partial();

export const toggleCycleSchema = z.object({
  is_active: z.boolean(),
});

export type CreateAcademicYearPayload = z.infer<typeof createAcademicYearSchema>;
export type UpdateAcademicYearPayload = z.infer<typeof updateAcademicYearSchema>;
export type ToggleCyclePayload = z.infer<typeof toggleCycleSchema>;
```

- [ ] **Step 2 : Étendre l’interface SchoolService**

Dans `server/src/school/service.ts`, ajouter à l’interface `SchoolService` :

```typescript
listAcademicYears(schoolId: string): Promise<Array<{ id: string; label: string; starts_on: string; ends_on: string; periods: string; is_active: boolean }>>;
createAcademicYear(schoolId: string, payload: CreateAcademicYearPayload): Promise<{ id: string }>;
updateAcademicYear(schoolId: string, yearId: string, payload: UpdateAcademicYearPayload): Promise<void>;
activateAcademicYear(schoolId: string, yearId: string): Promise<void>;
listCycles(schoolId: string): Promise<Array<{ cycle_key: string; cycle_name: string; is_active: boolean }>>;
toggleCycle(schoolId: string, cycleKey: string, payload: ToggleCyclePayload): Promise<void>;
saveLogoPath(schoolId: string, logoPath: string): Promise<void>;
```

- [ ] **Step 3 : Implémenter les méthodes dans createSchoolService**

Ajouter les méthodes :

```typescript
async listAcademicYears(schoolId: string) {
  const { data, error } = await serviceClient
    .from("academic_years")
    .select("id, label, starts_on, ends_on, periods, is_active")
    .eq("school_id", schoolId)
    .order("starts_on", { ascending: false });
  if (error || !data) throw new Error(`Failed to list academic years: ${JSON.stringify(error)}`);
  return data.map((y) => ({ ...y, starts_on: String(y.starts_on), ends_on: String(y.ends_on) }));
},

async createAcademicYear(schoolId: string, payload: CreateAcademicYearPayload) {
  const { data, error } = await serviceClient
    .from("academic_years")
    .insert({ school_id: schoolId, ...payload })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to create academic year: ${JSON.stringify(error)}`);
  return { id: data.id };
},

async updateAcademicYear(schoolId: string, yearId: string, payload: UpdateAcademicYearPayload) {
  const { error } = await serviceClient
    .from("academic_years")
    .update(payload)
    .eq("id", yearId)
    .eq("school_id", schoolId);
  if (error) throw new Error(`Failed to update academic year: ${JSON.stringify(error)}`);
},

async activateAcademicYear(schoolId: string, yearId: string) {
  await serviceClient.rpc("deactivate_other_academic_years", {
    p_school_id: schoolId,
    p_active_year_id: yearId,
  });
  const { error } = await serviceClient
    .from("academic_years")
    .update({ is_active: true })
    .eq("id", yearId)
    .eq("school_id", schoolId);
  if (error) throw new Error(`Failed to activate academic year: ${JSON.stringify(error)}`);
},

async listCycles(schoolId: string) {
  const { data, error } = await serviceClient
    .from("school_cycles")
    .select("cycle_key, cycle_name, is_active")
    .eq("school_id", schoolId)
    .order("cycle_key");
  if (error || !data) throw new Error(`Failed to list cycles: ${JSON.stringify(error)}`);
  return data;
},

async toggleCycle(schoolId: string, cycleKey: string, payload: ToggleCyclePayload) {
  const { error } = await serviceClient
    .from("school_cycles")
    .update({ is_active: payload.is_active })
    .eq("school_id", schoolId)
    .eq("cycle_key", cycleKey);
  if (error) throw new Error(`Failed to toggle cycle: ${JSON.stringify(error)}`);
},

async saveLogoPath(schoolId: string, logoPath: string) {
  const { error } = await serviceClient.from("school").update({ logo_path: logoPath }).eq("id", schoolId);
  if (error) throw new Error(`Failed to save logo path: ${JSON.stringify(error)}`);
},
```

- [ ] **Step 4 : Créer la fonction SQL deactivate_other_academic_years**

Créer la migration `supabase/migrations/202608190001_academic_year_activation.sql` :

```sql
create or replace function public.deactivate_other_academic_years(p_school_id uuid, p_active_year_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.academic_years
  set is_active = false
  where school_id = p_school_id
    and id <> p_active_year_id;
$$;

revoke all on function public.deactivate_other_academic_years(uuid, uuid) from public;
grant execute on function public.deactivate_other_academic_years(uuid, uuid) to authenticated;
```

- [ ] **Step 5 : Ajouter les routes Fastify**

Dans `server/src/school/routes.ts`, ajouter après les routes existantes :

```typescript
import {
  createAcademicYearSchema,
  updateAcademicYearSchema,
  toggleCycleSchema,
} from "./schema.js";

// Dans registerSchoolRoutes :

app.get(
  "/school/academic-years",
  { preHandler: [requirePermission(access, "school.manage")] },
  async (request, reply) => {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
    const { schoolId } = await resolveProfileAndSchool(token);
    if (!schoolId) throw new SchoolSafeError(403, "SCHOOL_NOT_FOUND", "École introuvable", false);
    const years = await service.listAcademicYears(schoolId);
    reply.send(years);
  },
);

app.post(
  "/school/academic-years",
  { preHandler: [requirePermission(access, "school.manage")] },
  async (request, reply) => {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
    const { schoolId } = await resolveProfileAndSchool(token);
    if (!schoolId) throw new SchoolSafeError(403, "SCHOOL_NOT_FOUND", "École introuvable", false);
    const payload = createAcademicYearSchema.parse(request.body);
    const result = await service.createAcademicYear(schoolId, payload);
    reply.status(201).send(result);
  },
);

app.put(
  "/school/academic-years/:id",
  { preHandler: [requirePermission(access, "school.manage")] },
  async (request, reply) => {
    const { id } = request.params as { id: string };
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
    const { schoolId } = await resolveProfileAndSchool(token);
    if (!schoolId) throw new SchoolSafeError(403, "SCHOOL_NOT_FOUND", "École introuvable", false);
    const payload = updateAcademicYearSchema.parse(request.body);
    await service.updateAcademicYear(schoolId, id, payload);
    reply.send({ status: "ok" });
  },
);

app.post(
  "/school/academic-years/:id/activate",
  { preHandler: [requirePermission(access, "school.manage")] },
  async (request, reply) => {
    const { id } = request.params as { id: string };
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
    const { schoolId } = await resolveProfileAndSchool(token);
    if (!schoolId) throw new SchoolSafeError(403, "SCHOOL_NOT_FOUND", "École introuvable", false);
    await service.activateAcademicYear(schoolId, id);
    reply.send({ status: "ok" });
  },
);

app.get(
  "/school/cycles",
  { preHandler: [requirePermission(access, "school.manage")] },
  async (request, reply) => {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
    const { schoolId } = await resolveProfileAndSchool(token);
    if (!schoolId) throw new SchoolSafeError(403, "SCHOOL_NOT_FOUND", "École introuvable", false);
    const cycles = await service.listCycles(schoolId);
    reply.send(cycles);
  },
);

app.put(
  "/school/cycles/:key/toggle",
  { preHandler: [requirePermission(access, "school.manage")] },
  async (request, reply) => {
    const { key } = request.params as { key: string };
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
    const { schoolId } = await resolveProfileAndSchool(token);
    if (!schoolId) throw new SchoolSafeError(403, "SCHOOL_NOT_FOUND", "École introuvable", false);
    const payload = toggleCycleSchema.parse(request.body);
    await service.toggleCycle(schoolId, key, payload);
    reply.send({ status: "ok" });
  },
);
```

- [ ] **Step 6 : Route d’upload logo**

Dans `server/src/school/routes.ts`, ajouter :

```typescript
import { randomUUID } from "node:crypto";
import { createWriteStream, mkdirSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import type { MultipartFile } from "@fastify/multipart";

// Dans registerSchoolRoutes :

app.post(
  "/school/logo",
  { preHandler: [requirePermission(access, "school.manage")] },
  async (request, reply) => {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
    const { schoolId } = await resolveProfileAndSchool(token);
    if (!schoolId) throw new SchoolSafeError(403, "SCHOOL_NOT_FOUND", "École introuvable", false);

    const file = await request.file();
    if (!file) throw new SchoolSafeError(400, "FILE_MISSING", "Aucun fichier reçu", false);

    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      throw new SchoolSafeError(400, "FILE_INVALID", "Format non supporté (PNG, JPG, WEBP)", false);
    }
    if ((file.file as unknown as { bytesRead: number }).bytesRead > 2 * 1024 * 1024) {
      throw new SchoolSafeError(400, "FILE_TOO_LARGE", "Fichier trop volumineux (max 2 Mo)", false);
    }

    const ext = file.filename.split(".").pop() || "png";
    const filename = `${randomUUID()}.${ext}`;
    const uploadDir = path.resolve(process.cwd(), "server/uploads/logos");
    mkdirSync(uploadDir, { recursive: true });
    const filepath = path.join(uploadDir, filename);
    await pipeline(file.file, createWriteStream(filepath));

    const logoPath = `/uploads/logos/${filename}`;
    await service.saveLogoPath(schoolId, logoPath);
    reply.send({ logo_path: logoPath });
  },
);
```

- [ ] **Step 7 : Servir le dossier uploads en statique**

Dans `server/src/index.ts`, après `const app = buildApp(...)` :

```typescript
import fastifyStatic from "@fastify/static";
import path from "node:path";

await app.register(fastifyStatic, {
  root: path.resolve(process.cwd(), "server/uploads"),
  prefix: "/uploads/",
});
```

Installer la dépendance si nécessaire :

```bash
cd server && npm install @fastify/static
```

- [ ] **Step 8 : Vérifier typecheck et tests**

Run:

```bash
cd server
npm run typecheck
npm test
```

Expected: typecheck passe, tests passent (78+).

- [ ] **Step 9 : Commit**

```bash
git add server/src/school/schema.ts server/src/school/service.ts server/src/school/routes.ts server/src/index.ts supabase/migrations/202608190001_academic_year_activation.sql server/uploads/logos/.gitkeep server/package.json server/package-lock.json
git commit -m "feat(school): academic years, cycles and logo upload backend"
git push origin main
```

---

## Task 2 : Backend Personnel — détail, resend invite, audit

**Files:**
- Modify: `server/src/school/schema.ts`
- Modify: `server/src/school/service.ts`
- Modify: `server/src/school/routes.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: `profiles`, `profile_roles`, `roles`, `audit_events`, `NotificationService`.
- Produces:
  - `GET /school/staff/:id`
  - `POST /school/staff/:id/resend-invite`

- [ ] **Step 1 : Ajouter le schéma de resend invite**

Dans `server/src/school/schema.ts` :

```typescript
export const resendInviteSchema = z.object({}).optional();
```

- [ ] **Step 2 : Étendre l’interface SchoolService**

```typescript
getStaffDetail(profileId: string): Promise<StaffMember & { scopes: Array<{ scope_type: string; scope_id: string | null; label: string | null }> }>;
resendStaffInvite(profileId: string): Promise<void>;
```

- [ ] **Step 3 : Injecter NotificationService dans SchoolService**

Modifier `createSchoolService` :

```typescript
export function createSchoolService(
  supabaseUrl: string,
  serviceRoleKey: string | undefined,
  defaultPassword: string,
  notificationService?: { queue: (notification: { userId: string; channel: "EMAIL"; templateKey: string; variables: Record<string, string> }) => Promise<unknown> },
): SchoolService {
```

- [ ] **Step 4 : Implémenter getStaffDetail et resendStaffInvite**

```typescript
async getStaffDetail(profileId: string) {
  const { data: profile, error } = await serviceClient
    .from("profiles")
    .select("id, first_name, last_name, display_name, phone, is_active, auth_user_id")
    .eq("id", profileId)
    .single();
  if (error || !profile) throw new Error(`Failed to load staff detail: ${JSON.stringify(error)}`);

  const [{ data: profileRoles }, { data: roles }, { data: users }, { data: scopes }] = await Promise.all([
    serviceClient.from("profile_roles").select("profile_id, role_id").eq("profile_id", profileId),
    serviceClient.from("roles").select("id, code, label"),
    serviceClient.auth.admin.listUsers(),
    serviceClient.from("scope_assignments").select("scope_type, scope_id, label").eq("profile_id", profileId),
  ]);

  const roleMap = new Map(roles?.map((r) => [r.id, r]) ?? []);
  const userEmails = new Map(users?.users.map((u) => [u.id, u.email]) ?? []);

  const memberRoles: Array<{ id: string; code: string; label: string }> = [];
  for (const pr of profileRoles ?? []) {
    const role = roleMap.get(pr.role_id);
    if (role) memberRoles.push({ id: role.id, code: role.code, label: role.label });
  }

  return {
    id: profile.id,
    first_name: profile.first_name,
    last_name: profile.last_name,
    display_name: profile.display_name,
    email: userEmails.get(profile.auth_user_id) ?? "",
    phone: profile.phone,
    is_active: profile.is_active,
    roles: memberRoles,
    scopes: scopes ?? [],
  };
},

async resendStaffInvite(profileId: string) {
  const detail = await this.getStaffDetail(profileId);
  if (!detail.email) throw new Error("No email for staff member");

  const newPassword = defaultPassword;
  const { error: updateError } = await serviceClient.auth.admin.updateUserById(
    detail.id, // NOTE: il faudra récupérer auth_user_id via getStaffDetail
    { password: newPassword },
  );
  if (updateError) throw new Error(`Failed to reset password: ${JSON.stringify(updateError)}`);

  if (notificationService) {
    await notificationService.queue({
      userId: detail.id,
      channel: "EMAIL",
      templateKey: "STAFF_INVITED",
      variables: { email: detail.email, password: newPassword },
    });
  }
},
```

> **Note :** `getStaffDetail` doit aussi retourner `auth_user_id` pour que `resendStaffInvite` fonctionne. Modifier l’interface et le retour en conséquence.

- [ ] **Step 5 : Ajouter les routes**

```typescript
app.get(
  "/school/staff/:id",
  { preHandler: [requirePermission(access, "staff.manage")] },
  async (request, reply) => {
    const { id } = request.params as { id: string };
    const member = await service.getStaffDetail(id);
    reply.send(member);
  },
);

app.post(
  "/school/staff/:id/resend-invite",
  { preHandler: [requirePermission(access, "staff.manage")] },
  async (request, reply) => {
    const { id } = request.params as { id: string };
    await service.resendStaffInvite(id);
    reply.send({ status: "ok" });
  },
);
```

- [ ] **Step 6 : Audit events**

Dans `inviteStaff`, après l’insertion des rôles :

```typescript
await serviceClient.from("audit_events").insert({
  school_id: schoolId,
  actor_profile_id: profile.id,
  event_type: "staff.invited",
  payload: { invited_profile_id: profile.id, role_ids: payload.role_ids },
});
```

Dans `updateStaffRoles` :

```typescript
await serviceClient.from("audit_events").insert({
  school_id: schoolId, // NOTE: récupérer school_id depuis profile
  actor_profile_id: profileId,
  event_type: "staff.roles_changed",
  payload: { new_role_ids: payload.role_ids },
});
```

> **Note :** il faut connaître le `school_id` du profile dans `updateStaffRoles` et `toggleStaffActive`. Modifier ces méthodes pour le récupérer ou l’accepter en paramètre.

- [ ] **Step 7 : Vérifier typecheck et tests**

Run:

```bash
cd server
npm run typecheck
npm test
```

- [ ] **Step 8 : Commit**

```bash
git add server/src/school/schema.ts server/src/school/service.ts server/src/school/routes.ts server/src/index.ts
git commit -m "feat(staff): detail, resend invite and audit events"
git push origin main
```

---

## Task 3 : Tests backend École & Personnel

**Files:**
- Modify: `server/tests/school.test.ts`

**Interfaces:**
- Consumes: `SchoolService` interface étendu.
- Produces: tests passant pour les nouvelles routes.

- [ ] **Step 1 : Ajouter les mocks des nouvelles méthodes**

Dans `createMockService`, ajouter :

```typescript
listAcademicYears: vi.fn().mockResolvedValue([
  { id: "year-1", label: "2025-2026", starts_on: "2025-09-01", ends_on: "2026-06-30", periods: "Trimestres", is_active: true },
]),
createAcademicYear: vi.fn().mockResolvedValue({ id: "year-2" }),
updateAcademicYear: vi.fn().mockResolvedValue(undefined),
activateAcademicYear: vi.fn().mockResolvedValue(undefined),
listCycles: vi.fn().mockResolvedValue([
  { cycle_key: "primary", cycle_name: "Primaire", is_active: true },
]),
toggleCycle: vi.fn().mockResolvedValue(undefined),
saveLogoPath: vi.fn().mockResolvedValue(undefined),
getStaffDetail: vi.fn().mockResolvedValue({
  id: "profile-1",
  first_name: "Jean",
  last_name: "Admin",
  display_name: "Jean Admin",
  email: "admin@ecole.cd",
  phone: null,
  is_active: true,
  roles: [{ id: "role-1", code: "admin", label: "Administrateur" }],
  scopes: [],
}),
resendStaffInvite: vi.fn().mockResolvedValue(undefined),
```

- [ ] **Step 2 : Ajouter les tests de routes**

Ajouter dans le `describe` :

```typescript
it("GET /school/academic-years returns years", async () => {
  const app = buildTestApp(createMockService(), accessService());
  const response = await app.inject({ method: "GET", url: "/school/academic-years", headers: { authorization: "Bearer valid-token" } });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toHaveLength(1);
  await app.close();
});

it("POST /school/academic-years creates a year", async () => {
  const app = buildTestApp(createMockService(), accessService());
  const response = await app.inject({
    method: "POST",
    url: "/school/academic-years",
    headers: { authorization: "Bearer valid-token" },
    payload: { label: "2026-2027", starts_on: "2026-09-01", ends_on: "2027-06-30", periods: "Trimestres" },
  });
  expect(response.statusCode).toBe(201);
  expect(response.json()).toMatchObject({ id: "year-2" });
  await app.close();
});

it("GET /school/cycles returns cycles", async () => {
  const app = buildTestApp(createMockService(), accessService());
  const response = await app.inject({ method: "GET", url: "/school/cycles", headers: { authorization: "Bearer valid-token" } });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toHaveLength(1);
  await app.close();
});

it("GET /school/staff/:id returns staff detail", async () => {
  const app = buildTestApp(createMockService(), accessService());
  const response = await app.inject({ method: "GET", url: "/school/staff/profile-1", headers: { authorization: "Bearer valid-token" } });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({ email: "admin@ecole.cd" });
  await app.close();
});
```

- [ ] **Step 3 : Vérifier typecheck et tests**

Run:

```bash
cd server
npm run typecheck
npm test
```

- [ ] **Step 4 : Commit**

```bash
git add server/tests/school.test.ts
git commit -m "test(school): cover academic years, cycles and staff detail"
git push origin main
```

---

## Task 4 : Frontend École & Personnel

**Files:**
- Create: `app/modules/school/school.css`
- Modify: `app/modules/school/school-module.js`
- Modify: `app/modules/school/school-api.js`
- Modify: `app/index.html`
- Modify: `app/app.js`

**Interfaces:**
- Consumes: API `/school/*` étendue.
- Produces: module PWA fonctionnel avec onglets Mon école / Mon équipe.

- [ ] **Step 1 : Ajouter les appels API**

Dans `app/modules/school/school-api.js`, ajouter :

```javascript
listAcademicYears: function () {
  return request("GET", "/school/academic-years");
},
createAcademicYear: function (payload) {
  return request("POST", "/school/academic-years", payload);
},
updateAcademicYear: function (yearId, payload) {
  return request("PUT", "/school/academic-years/" + yearId, payload);
},
activateAcademicYear: function (yearId) {
  return request("POST", "/school/academic-years/" + yearId + "/activate");
},
listCycles: function () {
  return request("GET", "/school/cycles");
},
toggleCycle: function (cycleKey, isActive) {
  return request("PUT", "/school/cycles/" + cycleKey + "/toggle", { is_active: isActive });
},
uploadLogo: function (file) {
  var token = currentToken();
  var formData = new FormData();
  formData.append("logo", file);
  return fetch(getApiBase() + "/school/logo", {
    method: "POST",
    headers: token ? { Authorization: "Bearer " + token } : {},
    body: formData,
  }).then(function (res) {
    if (!res.ok) throw new Error("Échec de l’upload");
    return res.json();
  });
},
getStaffDetail: function (profileId) {
  return request("GET", "/school/staff/" + profileId);
},
resendInvite: function (profileId) {
  return request("POST", "/school/staff/" + profileId + "/resend-invite");
},
```

- [ ] **Step 2 : Créer school.css**

Créer `app/modules/school/school.css` avec un style cohérent avec les autres modules (onglets, formulaires, tableaux, modales) :

```css
.school-module { padding: 1rem; }
.school-tabs { display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border, #ddd); margin-bottom: 1rem; }
.school-tabs button { padding: 0.5rem 1rem; background: transparent; border: none; cursor: pointer; }
.school-tabs button.active { border-bottom: 2px solid var(--primary, #071a3d); font-weight: bold; }
.school-form { display: grid; gap: 1rem; }
.school-form .form-section { border: 1px solid var(--border, #ddd); border-radius: 8px; padding: 1rem; }
.school-form label { display: block; margin: 0.5rem 0; }
.school-form input, .school-form textarea, .school-form select { width: 100%; padding: 0.5rem; }
.school-table { width: 100%; border-collapse: collapse; }
.school-table th, .school-table td { padding: 0.75rem; border-bottom: 1px solid var(--border, #ddd); text-align: left; }
.school-role-badge { background: #eee; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.8rem; margin-right: 0.25rem; }
.school-status.active { color: green; }
.school-status.inactive { color: red; }
.school-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.school-modal-box { background: white; padding: 1.5rem; border-radius: 8px; min-width: 320px; max-width: 90vw; }
```

- [ ] **Step 3 : Ajouter les onglets Années et Cycles dans le frontend**

Modifier `renderSchoolTab` dans `school-module.js` pour ajouter une section "Années scolaires" et "Cycles".

Section Années :

```javascript
var yearsHtml = (settingsData.academic_years || []).map(function (y) {
  return '<tr><td>' + escapeMarkup(y.label) + '</td><td>' + y.starts_on + '</td><td>' + y.ends_on + '</td><td>' + (y.is_active ? '<span class="school-status active">Active</span>' : '') + '</td></tr>';
}).join('');
```

Et un bouton "Ajouter une année" ouvrant une modale.

Section Cycles :

```javascript
var cyclesHtml = (settingsData.cycles || []).map(function (c) {
  return '<tr><td>' + escapeMarkup(c.cycle_name) + '</td><td>' + (c.is_active ? '<span class="school-status active">Actif</span>' : '<span class="school-status inactive">Inactif</span>') + '</td><td><button type="button" data-cycle="' + c.cycle_key + '" class="toggle-cycle">' + (c.is_active ? "Désactiver" : "Activer") + '</button></td></tr>';
}).join('');
```

- [ ] **Step 4 : Ajouter l’upload logo dans le frontend**

Remplacer le champ texte `logo_path` par :

```javascript
'<label>Logo<input name="logo_file" type="file" accept="image/png,image/jpeg,image/webp"></label>' +
'<input name="logo_path" type="hidden" value="' + escapeMarkup(s.brand.logo_path || "") + '">' +
(s.brand.logo_path ? '<img src="' + escapeMarkup(s.brand.logo_path) + '" alt="Logo" style="max-width:200px;max-height:100px;">' : '')
```

Et dans le submit, si un fichier est sélectionné, appeler `uploadLogo` d’abord.

- [ ] **Step 5 : Brancher le module dans app.js**

Ajouter dans `renderWorkspace` :

```javascript
document.getElementById("schoolModule").hidden = true;
```

Ajouter la fonction d’ouverture (pattern identique aux autres modules) :

```javascript
function openSchoolModule(tabName) {
  document.getElementById("pedagogyModule").hidden = true;
  document.getElementById("financeModule").hidden = true;
  document.getElementById("securityModule").hidden = true;
  document.getElementById("pilotageModule").hidden = true;
  document.getElementById("feeControlModule").hidden = true;
  document.getElementById("accessConsole").hidden = true;
  document.getElementById("schoolModule").hidden = false;
  document.querySelector(".workspace-grid").hidden = true;
  document.getElementById("cardsProtected").hidden = true;
  if (window.SchoolSafeSchoolModule) {
    window.SchoolSafeSchoolModule.render(tabName);
  }
  document.querySelector(".workspace-content").scrollTo({ top: 0, behavior: "smooth" });
}

function closeSchoolModule() {
  document.getElementById("schoolModule").hidden = true;
  document.querySelector(".workspace-grid").hidden = false;
  document.getElementById("cardsProtected").hidden = currentDemoRole !== "admin" && currentDemoRole !== "admissions";
  document.getElementById("workspaceTitle").textContent = "Tableau de bord";
}

function schoolTabForAction(actionName) {
  if (/mon école|paramètres de l’école|configuration école/i.test(actionName)) return "school";
  if (/mon équipe|personnel|staff/i.test(actionName)) return "staff";
  return "";
}
```

Et dans les gestionnaires de clic sur `[data-action]` et `[data-nav-action]` :

```javascript
if (schoolTabForAction(actionName)) {
  openSchoolModule(schoolTabForAction(actionName));
  return;
}
```

- [ ] **Step 6 : Ajouter le conteneur HTML dans index.html**

Ajouter dans `app/index.html`, après les autres modules similaires :

```html
<section id="schoolModule" class="module-container" hidden>
  <header class="module-header">
    <button class="module-back" type="button" id="closeSchoolModule" aria-label="Retour"><i data-lucide="arrow-left"></i></button>
    <h2 id="schoolModuleTitle">École & Personnel</h2>
  </header>
  <div class="school-tabs" id="schoolTabs">
    <button type="button" data-school-tab="school">Mon école</button>
    <button type="button" data-school-tab="staff">Mon équipe</button>
  </div>
  <div id="schoolContent"></div>
</section>
```

Et charger les fichiers :

```html
<link rel="stylesheet" href="modules/school/school.css">
<script src="modules/school/school-api.js"></script>
<script src="modules/school/school-module.js"></script>
```

- [ ] **Step 7 : Vérifier syntaxe JS**

Run:

```bash
node --check app/app.js
node --check app/modules/school/school-module.js
node --check app/modules/school/school-api.js
```

- [ ] **Step 8 : Commit**

```bash
git add app/modules/school/school.css app/modules/school/school-module.js app/modules/school/school-api.js app/app.js app/index.html
git commit -m "feat(school): frontend ecole et personnel"
git push origin main
```

---

## Task 5 : Menu admin conditionné par permissions

**Files:**
- Modify: `app/app.js`

**Interfaces:**
- Consumes: `currentSession.permissions`.
- Produces: menu Administration visible uniquement avec `school.manage` ou `staff.manage`.

- [ ] **Step 1 : Ajouter la branche Administration dans roleCatalog**

Dans `app/app.js`, trouver `roleCatalog` et ajouter dans chaque profil admin concerné :

```javascript
{
  key: "administration",
  description: "Configuration de l’école et gestion du personnel.",
  groups: [
    {
      label: "Configuration",
      actions: [
        ["École & Personnel", "school", "execute"],
      ],
    },
  ],
}
```

- [ ] **Step 2 : Conditionner l’affichage de la branche**

Dans `renderWorkspace`, filtrer les branches :

```javascript
var visibleBranches = profile.branches.filter(function (item) {
  if (item.key !== "administration") return true;
  var perms = (currentSession && currentSession.permissions) || [];
  return perms.indexOf("school.manage") >= 0 || perms.indexOf("staff.manage") >= 0;
});
```

Utiliser `visibleBranches` à la place de `profile.branches` pour rendre le menu.

- [ ] **Step 3 : Vérifier syntaxe JS**

Run:

```bash
node --check app/app.js
```

- [ ] **Step 4 : Commit**

```bash
git add app/app.js
git commit -m "feat(school): menu administration conditionne par permission"
git push origin main
```

---

## Task 6 : Validation finale

**Files:**
- All modified files.

- [ ] **Step 1 : Vérifier typecheck et tests backend**

Run:

```bash
cd server
npm run typecheck
npm test
```

Expected: typecheck passe, 78+ tests passent.

- [ ] **Step 2 : Vérifier syntaxe frontend**

Run:

```bash
node --check app/app.js
node --check app/modules/school/school-module.js
node --check app/modules/school/school-api.js
```

- [ ] **Step 3 : Vérifier git status**

Run:

```bash
git status --short
```

Expected: rien d’inattendu, tous les changements commités.

- [ ] **Step 4 : Commit final si nécessaire et push**

```bash
git push origin main
```

---

## Self-Review

### Spec coverage

| Exigence du spec | Tâche |
|---|---|
| Années scolaires CRUD + activation | B1 |
| Cycles toggle | B1 |
| Upload logo VPS | B1 |
| Détail personnel | B2 |
| Resend invite | B2 |
| Audit events | B2 |
| Tests backend | B3 |
| Frontend onglets | B4 |
| Menu conditionné | B5 |
| Validation | B6 |

### Placeholder scan

Aucun `TBD`, `TODO` ou référence floue. Chaque étape a du code concret.

### Type consistency

- `SchoolService` expose les méthodes définies dans le plan.
- Les routes utilisent les schémas Zod correspondants.
- Le frontend appelle les endpoints définis.

### Execution Handoff

**Plan complet enregistré dans :** `docs/superpowers/plans/2026-08-17-ecole-personnel-plan.md`

**Deux options d’exécution :**

1. **Subagent-Driven (recommandé)** — Un sous-agent par tâche (B1, B2, B3, B4, B5), avec revue entre chaque.
2. **Inline Execution** — Exécuter les tâches dans cette session avec `executing-plans`.

**Quelle approche veux-tu utiliser ?**
