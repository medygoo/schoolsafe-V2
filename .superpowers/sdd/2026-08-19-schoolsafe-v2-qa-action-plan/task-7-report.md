# Task 7 Report — Exécution du plan QA complet et correctifs de la revue

## Status

DONE — final fix round appliquée sur la base des findings de la revue whole-branch.

## Correctifs appliqués

### [HIGH] Silent audit failures dans `requirePermission`

- **Fichier** : `server/src/access/guard.ts:88-90`
- **Action** : après le log d'erreur, on relance désormais une `SchoolSafeError(500, "AUDIT_UNAVAILABLE", ...)` pour rendre observable toute perte d'audit.
- **Impact** : l'échec d'insertion d'un événement d'audit n'est plus silencieux ; la requête échoue explicitement avec un code 500.

### [MEDIUM] Script QA principal sans RLS

- **Fichier** : `package.json`
- **Action** :
  - ajout du script `test:qa:rls` : `npx vitest run tests/qa/rls` ;
  - mise à jour de `test:qa` pour inclure `tests/qa/rls`.

### [MEDIUM] Rapport surestimant la couverture des permissions

- **Fichiers** : `tests/qa/sample-results.json`, `tests/qa/qa-report-template.md`, `tests/qa/generate-report.ts`
- **Action** :
  - ajout du champ `permissionCoveredCount` (18 / 46) ;
  - le template distingue désormais "Permissions cataloguées" et "Permissions couvertes par au moins un test".

### [MEDIUM] Scope denial du scan sécurité non audité

- **Fichier** : `server/src/security/routes.ts:37-40`
- **Action** :
  - `SecurityRouteDependencies` reçoit `resolveProfileAndSchool` et un `audit?: AuditService` ;
  - lorsque le scope `assigned_portal` échoue, un événement `access.denied` est inséré dans `audit_events` avant le lancement du `SCOPE_DENIED`.
- **Mise à jour des tests** : `server/tests/security.test.ts`, `server/tests/notifications/integration.test.ts`, `tests/qa/integration/helpers/harness.ts`, `tests/qa/integration/security.flows.test.ts`.

### [MEDIUM] Couverture E2E ne couvrant pas les 15 profils

- **Fichier** : `tests/qa/sample-results.json`
- **Action** : ajout d'un écart P2 documentant que seuls 6 des 15 profils référence sont couverts par les specs Playwright actuelles.

## Commandes exécutées

1. `npm run typecheck`
   - ✅ succès.

2. `npm run test` (server tests)
   - ✅ 142 tests passés sur 142.

3. `npm run test:qa`
   - Integration tests : 17 passés.
   - Unit tests : 7 échecs (pas d'instance Supabase locale).
   - RLS tests : 7 échecs (`ECONNREFUSED 127.0.0.1:54322`).
   - E2E tests : non exécutés car la commande combinée s'arrête sur les échecs unitaires/RLS (comportement attendu).

4. `npx playwright test tests/qa/e2e`
   - ✅ 46 passés, 0 échec.

5. `npx tsx tests/qa/generate-report.ts tests/qa/sample-results.json`
   - Rapport final régénéré : `tests/qa/qa-report-2026-08-20.md`.

## Résultats consolidés

| Suite | Passés | Total | Notes |
|-------|--------|-------|-------|
| Tests unitaires | 0 | 7 | Bloqués : `supabase start` impossible (Docker/Podman indisponible) |
| Tests RLS | 0 | 7 | Échouent : `ECONNREFUSED 127.0.0.1:54322` (Supabase locale absente) |
| Tests intégration | 17 | 17 | Passent via le harness Fastify mocké |
| Tests E2E | 46 | 46 | Passent contre la PWA statique en mode démo |
| Permissions cataloguées | 46 | 46 | Total du catalogue SchoolSafe V2 |
| Permissions couvertes par au moins un test | 18 | 46 | Sous-ensemble explicitement exercé |
| Profils couverts E2E | 6 | 15 | Écart documenté en P2 |

## Fichiers produits / mis à jour

- `server/src/http/errors.ts` — ajout du code `AUDIT_UNAVAILABLE`.
- `server/src/access/guard.ts` — propagation explicite des échecs d'audit.
- `server/src/security/routes.ts` — audit du `SCOPE_DENIED` sur `/security/scan`.
- `server/src/index.ts` — injection de `resolveProfileAndSchool` et `auditService` dans les dépendances sécurité.
- `package.json` — scripts `test:qa` et `test:qa:rls` mis à jour.
- `tests/qa/generate-report.ts` — champ `permissionCoveredCount`.
- `tests/qa/qa-report-template.md` — distinction catalogue vs couverture.
- `tests/qa/sample-results.json` — `permissionCoveredCount: 18` + écart E2E P2.
- `tests/qa/qa-report-2026-08-20.md` — rapport régénéré.
- `server/tests/security.test.ts` — tests ajustés au nouveau découpage + test d'audit du scope denial.
- `server/tests/notifications/integration.test.ts` — ajustement au nouveau `resolveProfileAndSchool`.
- `tests/qa/integration/helpers/harness.ts` — injection de `auditService` et `resolveProfileAndSchool` pour la sécurité.
- `tests/qa/integration/security.flows.test.ts` — assertion sur l'audit en cas de scope denial.

## Concerns

- L'absence de runtime Supabase locale empêche la validation réelle des tests unitaires et RLS.
- Le rapport reflète donc un état partiel : les écarts de la section 9 du diagnostic restent à vérifier sur une vraie base de données.
- La couverture E2E des 15 profils référence reste un écart P2 documenté ; 9 specs Playwright supplémentaires sont à planifier.
