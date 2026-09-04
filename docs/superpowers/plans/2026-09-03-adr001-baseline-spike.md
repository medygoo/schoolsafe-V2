# ADR-001 + Spike Baseline v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sceller la décision d'architecture (ADR-001) et produire le spike qui prouvera, sur le conteneur TEST isolé uniquement, que la baseline PostgreSQL v1 enforce le contexte transactionnel, le DENY par défaut et l'ACL par fonctions — sans jamais toucher à une infrastructure de production.

**Architecture:** Décision consignée dans `docs/adr/ADR-001-data-lineage-and-api-layer.md`. Le spike est un script Node (`pg` déjà en devDependencies racine) qui se connecte à `schoolsafe_test` avec le rôle `schoolsafe_api`, tente des opérations SANS identité valide et exige des refus fail-closed. Aucune donnée seed requise : le spike prouve les REFUS, pas les succès.

**Tech Stack:** Markdown ADR, Node ESM, `pg` 8.23.0, `node --test`.

**Spec:** audits de session (verdict READY_FOR_ARCHITECTURE_DECISION, scores A=4,35/B=2,70/C=2,55) et `database/baseline/v1/README.md` + `DB-04B-EXECUTION-PLAN.md`.

## Global Constraints

- Aucun accès VPS, Supabase Cloud, Docker ou PROD pendant l'écriture de ce lot ; l'exécution du spike exige un « GO » humain séparé.
- La baseline reste appliquable uniquement sur conteneur `schoolsafe-postgres-test`, base `schoolsafe_test`, via `run-from-zero-test.sh` manuel.
- Le spike ne prend JAMAIS de mot de passe en argument de ligne de commande ; `PGPASSWORD` en variable d'environnement, jamais affichée.
- Le spike refuse toute base ≠ `schoolsafe_test` et tout rôle ≠ `schoolsafe_api`.
- Catalogue figé : 60 permissions, 7 scopes — le plan n'en modifie aucun.
- Aucun fichier existant modifié ; uniquement des créations.
- Access_Law : la base est la seule autorité ; DENY explicite prioritaire ; fail-closed partout.

---

### Task 1: ADR-001 — Décision d'architecture

**Files:**
- Create: `docs/adr/ADR-001-data-lineage-and-api-layer.md`

**Interfaces:**
- Consumes: résultats d'audit (scores pondérés, findings P0/P1).
- Produces: la décision que les lots L1+ citent ; statuts `PROPOSED` / `PROVISIONAL` explicites.

- [ ] **Step 1: Écrire l'ADR**

Contenu intégral à écrire (statuts honnêtes : l'auth est PROVISIONAL jusqu'à ratification post-spike) :

```markdown
# ADR-001 — Lignée de données et couche API de SchoolSafe V2

- Statut : PROPOSED (points 1-3, 5) · PROVISIONAL (point 2, en attente du spike)
- Date : 2026-09-03
- Branche : work/backend-db-reconciliation @ 9ba0bb5

## Contexte

Deux backends coexistent, tous deux couplés à Supabase (server/ Fastify 7 482 lignes,
15 domaines, 177 cas de test ; workers/ Hono 1 032 lignes, 6 domaines, 9 cas de test,
paiement non atomique workers/src/services/finance.ts:32-63). La baseline
database/baseline/v1 (13 unités, 4 080 lignes, RLS forcée, moteur de conditions,
60 permissions / 7 scopes) est du PostgreSQL 17.11 autonome SANS Supabase : son
schéma auth est vide réservé et elle exige l'injection du contexte transactionnel
schoolsafe.user_id|profile_id|school_id|request_id via api.set_request_context().
Aucun backend actuel n'effectue cette injection (0 occurrence de set_config dans
server/src et workers/src).

## Décision

1. La base de données cible est PostgreSQL 17.11 autonome selon database/baseline/v1.
2. PROVISIONAL : l'authentification est maison dans le schéma auth (email/téléphone +
   mot de passe argon2id, sessions opaques, refresh côté serveur). À ratifier après
   le spike. Alternative conservée : Supabase Auth uniquement pour la signature JWT.
3. L'API de l'école est le serveur Fastify du VPS. Après authentification vérifiée,
   chaque requête ouvre une transaction, appelle api.set_request_context(), puis
   n'accède aux données QUE par les fonctions du schéma api (le rôle schoolsafe_api
   n'a aucun privilège direct sur les tables).
4. Le Worker Cloudflare est gelé : aucune logique métier nouvelle ; repositionnement
   possible en edge statique/cache ultérieur (option C en horizon).
5. Supabase sort du chemin de données métier.

## Alternatives rejetées (scores pondérés d'audit)

- B — Worker → PostgreSQL VPS : 2,70/5. Hyperdrive absent, SET LOCAL à travers un
  pooler non prouvé, couverture 6/15 domaines, 9 tests, paiement non atomique.
- C — Worker gateway → Fastify → PG : 2,55/5. Trois sauts, deux codes, sur-ingénierie
  pour une instance mono-école.

## Conséquences

- Les services server/ sont portés du SDK Supabase vers des appels api.* (SQL).
- Le catalogue shared/permissions.json gagne ultérieurement un champ condition
  (le moteur iam.condition_matches existe déjà dans la baseline).
- app/shared/permissions.json doit être servi (précache SW aujourd'hui en 404).
- L'auth maison exige un lot dédié (hachage argon2id, sessions, révocation, audit).
```

- [ ] **Step 2: Vérification**

Run: `Get-Content docs/adr/ADR-001-data-lineage-and-api-layer.md`
Expected: le fichier existe, les 4 statuts et les 5 décisions sont présents.

---

### Task 2: Test statique RED du script de spike

**Files:**
- Create: `tests/spike/spike-static.test.mjs`

**Interfaces:**
- Consumes: le source de `scripts/spike-baseline-context.mjs` (Task 3).
- Produces: contrat statique — le spike refuse hors TEST, ne logue jamais le mot de passe, rollback systématique.

- [ ] **Step 1: Écrire le test (RED — le script n'existe pas encore)**

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../../scripts/spike-baseline-context.mjs", import.meta.url), "utf8");

test("spike refuses any database other than schoolsafe_test", () => {
  assert.match(src, /PGDATABASE\s*!==\s*"schoolsafe_test"/);
});

test("spike refuses any role other than schoolsafe_api", () => {
  assert.match(src, /PGUSER\s*!==\s*"schoolsafe_api"/);
});

test("spike requires an explicit confirmation token", () => {
  assert.match(src, /SPIKE_SCHOOLSAFE_TEST_ONLY/);
});

test("spike never prints the password", () => {
  assert.doesNotMatch(src, /console\.(log|info|error)\([^)]*PGPASSWORD/);
});

test("spike calls api.set_request_context with parameters, never string interpolation", () => {
  assert.match(src, /api\.set_request_context\(\$1,\s*\$2,\s*\$3,\s*\$4\)/);
});

test("spike always rolls back", () => {
  assert.match(src, /ROLLBACK/);
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `node --test tests/spike/spike-static.test.mjs`
Expected: FAIL — `ENOENT` sur `scripts/spike-baseline-context.mjs`.

---

### Task 3: Script de spike (GREEN)

**Files:**
- Create: `scripts/spike-baseline-context.mjs`

**Interfaces:**
- Consumes: `pg` (devDependency racine), env `PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD SCHOOLSAFE_SPIKE_CONFIRM`.
- Produces: code de sortie 0 + résumé JSON `{ contextRejected, accessDenied, tableDenied }` ; non-zéro sinon. Utilisé par le runbook (Task 4).

- [ ] **Step 1: Écrire le script**

```javascript
// Spike baseline v1 — prouve les REFUS fail-closed sur schoolsafe_test uniquement.
// Jamais de PROD, jamais de seed : on vérifie que SANS identité valide, tout est refusé.
import pg from "pg";

function fail(message) {
  console.error(JSON.stringify({ ok: false, reason: message }));
  process.exit(1);
}

if (process.env.SCHOOLSAFE_SPIKE_CONFIRM !== "SPIKE_SCHOOLSAFE_TEST_ONLY") {
  fail("missing confirmation token");
}
if (process.env.PGDATABASE !== "schoolsafe_test") fail("PGDATABASE must be schoolsafe_test");
if (process.env.PGUSER !== "schoolsafe_api") fail("PGUSER must be schoolsafe_api");
if (!process.env.PGPASSWORD) fail("PGPASSWORD env required (never printed)");

const client = new pg.Client();
await client.connect();

const result = { contextRejected: false, accessDenied: false, tableDenied: false };
try {
  await client.query("BEGIN");

  // 1. Contexte incomplet refusé (fail-closed)
  try {
    await client.query("select api.set_request_context($1, $2, $3, $4)", [null, null, null, null]);
  } catch (err) {
    result.contextRejected = /Complete SchoolSafe request context is required/.test(err.message);
  }

  // 2. check_access sans contexte valide => false (DENY par défaut)
  const { rows } = await client.query("select api.check_access($1) as allowed", ["school.manage"]);
  result.accessDenied = rows[0] && rows[0].allowed === false;

  // 3. Lecture directe de table métier refusée au rôle schoolsafe_api (ACL fonctions seules)
  try {
    await client.query("select count(*) from app.schools");
  } catch (err) {
    result.tableDenied = /permission denied/i.test(err.message);
  }
} finally {
  await client.query("ROLLBACK").catch(() => {});
  await client.end().catch(() => {});
}

const ok = result.contextRejected && result.accessDenied && result.tableDenied;
console.log(JSON.stringify({ ok, ...result }));
process.exit(ok ? 0 : 1);
```

- [ ] **Step 2: Vérifier la syntaxe**

Run: `node --check scripts/spike-baseline-context.mjs`
Expected: aucune sortie d'erreur.

- [ ] **Step 3: Vérifier que le test passe (GREEN)**

Run: `node --test tests/spike/spike-static.test.mjs`
Expected: 6/6 PASS.

- [ ] **Step 4: Vérifier le refus sans token (fail-closed observable sans Docker)**

Run: `node scripts/spike-baseline-context.mjs`
Expected: exit 1, `{"ok":false,"reason":"missing confirmation token"}` — prouve le garde-fou SANS aucune connexion.

---

### Task 4: Runbook d'exécution (revue uniquement, aucune exécution)

**Files:**
- Create: `database/baseline/v1/review/SPIKE_RUNBOOK.md`

**Interfaces:**
- Consumes: `scripts/spike-baseline-context.mjs` (Task 3), `scripts/run-from-zero-test.sh` existant.
- Produces: procédure manuelle que l'opérateur VPS suivra APRÈS un « GO » humain explicite.

- [ ] **Step 1: Écrire le runbook**

```markdown
# SPIKE RUNBOOK — review only, execution requires explicit human GO

Prérequis : DB-04C appliqué via scripts/run-from-zero-test.sh (procédure existante,
conteneur schoolsafe-postgres-test, base schoolsafe_test, port 5432 NON publié).

Le spike ne publie aucun port : il tourne dans un conteneur jetable attaché au
réseau interne schoolsafe-test-internal.

1. Depuis un terminal VPS autorisé root :
   docker run --rm --network schoolsafe-test-internal \
     -e PGHOST=schoolsafe-postgres-test -e PGPORT=5432 \
     -e PGDATABASE=schoolsafe_test -e PGUSER=schoolsafe_api \
     -e PGPASSWORD='<secret jamais commité>' \
     -e SCHOOLSAFE_SPIKE_CONFIRM=SPIKE_SCHOOLSAFE_TEST_ONLY \
     -v "$PWD/scripts:/spike:ro" -w /spike \
     node:20 node spike-baseline-context.mjs

2. Attendu : {"ok":true,"contextRejected":true,"accessDenied":true,"tableDenied":true}

3. Consigner la sortie dans docs/adr/ADR-001 (addendum « preuve du spike ») puis
   ratifier le point 2 (auth) de l'ADR.

Interdit : tout autre conteneur, toute autre base, toute publication de port,
toute donnée métier réelle.
```

- [ ] **Step 2: Vérification**

Run: `Get-Content database/baseline/v1/review/SPIKE_RUNBOOK.md`
Expected: fichier présent, mention « review only » et interdictions finales.

---

## Self-Review

- **Spec coverage :** ADR (décision d'architecture) → Task 1 ; spike prouvant contexte/DENY/ACL → Tasks 2-3 ; procédure d'exécution encadrée → Task 4. Trou auth documenté comme PROVISIONAL dans l'ADR. ✔
- **Placeholders :** aucun TBD/TODO ; tout le code est fourni. ✔
- **Type consistency :** `api.set_request_context($1,$2,$3,$4)` et `schoolsafe_api`/`schoolsafe_test` identiques dans test, script et runbook ; noms de fonctions copiés de `08_internal_functions.sql:92` et `01_roles.sql:14`. ✔
