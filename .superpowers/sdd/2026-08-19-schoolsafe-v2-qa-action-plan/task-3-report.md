# Task 3 — Rapport : tests RLS par module

## Status

Implémentation terminée, **exécution bloquée par l'environnement local**.

Les fichiers de test demandés sont créés et le runner TypeScript est fonctionnel. La commande `npx vitest run tests/qa/rls/rls.test.ts` échoue systématiquement avec `connect ECONNREFUSED 127.0.0.1:54322` car l'instance Supabase locale n'est pas démarrable sur cette machine (Docker Desktop ne parvient pas à démarrer).

## Fichiers créés

- `tests/qa/rls/runner.ts` — exécute chaque fichier SQL via `pg` sur `TEST_DATABASE_URL` (fallback local Supabase).
- `tests/qa/rls/rls.test.ts` — wrapper Vitest qui lance les 7 fichiers SQL.
- `tests/qa/rls/auth.setup.test.sql`
- `tests/qa/rls/school.setup.test.sql`
- `tests/qa/rls/finance.setup.test.sql`
- `tests/qa/rls/security.setup.test.sql`
- `tests/qa/rls/pedagogy.setup.test.sql`
- `tests/qa/rls/pilotage.setup.test.sql`
- `tests/qa/rls/platform.setup.test.sql`

## Méthodologie

Chaque fichier SQL :

1. Crée une école, des profils, des rôles, des permissions et des portées dédiées aux tests (UUID aléatoires).
2. Simule `has_condition()` par une fonction temporaire `pg_temp.has_condition()` lisant `app.condition_<nom>`.
3. Simule le contexte authentifié avec `request.jwt.claims` et `SET LOCAL ROLE authenticated`.
4. Vérifie `has_permission`, `has_scope`, `has_condition` et effectue des opérations réelles sous RLS.
5. Nettoie les données en fin de transaction.

## Résultat du test commandé

```text
$ npx vitest run tests/qa/rls/rls.test.ts

❯ tests/qa/rls/rls.test.ts (7 tests | 7 failed) 51ms
  × RLS module tests > runs auth.setup.test.sql
  × RLS module tests > runs school.setup.test.sql
  × RLS module tests > runs finance.setup.test.sql
  × RLS module tests > runs security.setup.test.sql
  × RLS module tests > runs pedagogy.setup.test.sql
  × RLS module tests > runs pilotage.setup.test.sql
  × RLS module tests > runs platform.setup.test.sql

Error: connect ECONNREFUSED 127.0.0.1:54322

Test Files  1 failed (1)
Tests  7 failed (7)
```

Échec dû à l'indisponibilité de la base locale, pas à une assertion métier.

## Synthèse par module (attendu après démarrage de Supabase)

| Module | Permission / condition clé | État attendu | Observation |
|--------|---------------------------|--------------|-------------|
| Auth & setup | `session.bootstrap` | OK | Isolement école actif via `current_school_id()`. |
| École | `school.class.read` + `assigned_classes` | Écart | `has_scope` existe mais la policy `classes_current_school` ne l'utilise pas. |
| École | `school.student.read` + `own_children` | Écart | Même constat sur `students_current_school`. |
| École | `school.guardian.manage`, `school.manage`, `staff.manage`, `roles.manage` | Partiel | Permission + audit OK, scope `school` non vérifié en RLS. |
| Finance | `finance.payment.record` + caisse ouverte | Partiel | Condition simulée ; RLS école OK. |
| Finance | `finance.payment.cancel` + délai | Partiel | Condition simulée ; RLS école OK. |
| Finance | `finance.control.scan` + campagne publiée | Partiel | Condition simulée ; RLS école OK. |
| Sécurité | `security.scan` + portail actif | Partiel | Condition simulée ; RLS école OK. |
| Sécurité | `security.lockdown.manage` + audit | Partiel | Permission OK, scope `school` non vérifié en RLS. |
| Pédagogie | `pedagogy.grade.manage` + période active + brouillon | Partiel | Conditions simulées ; RLS école OK. |
| Pédagogie | `pedagogy.assignment.manage` + `assigned_classes` / `assigned_subjects` | Écart | `has_scope` non appliqué dans `assignments_current_school`. |
| Pilotage | `pilotage.approvals.manage` + statut `pending` | Écart | La policy `approval_requests_current_school` utilise `app.current_school_id` au lieu de `public.current_school_id()`, court-circuitant la chaîne USER→SCHOOL. |
| Pilotage | `pilotage.dashboard.read` + scope `school` | Partiel | Permission + scope OK, RLS à vérifier. |
| Plateforme | `file.upload` + type/taille valides | Partiel | Conditions simulées ; pas de table fichier avec RLS. |
| Plateforme | `sync.submit` + audit | OK | Audit inséré via RLS `current_school_id()` / `current_profile_id()`. |

## Concerns

1. **Environnement local** : Docker Desktop ne démarre pas (`cannot find registry key`), empêchant tout test RLS local. Les tests sont prêts mais non exécutés.
2. **has_condition() manquant** : conformément au brief, les conditions sont simulées via `pg_temp.has_condition()` et `set_config`. Dès que `has_condition()` sera implémenté, les fichiers SQL devront être mis à jour pour appeler la vraie fonction.
3. **RLS et portées** : aucune policy existante n'utilise `has_scope`. Les tests `school.setup.test.sql` et `pedagogy.setup.test.sql` contiennent des assertions volontairement strictes qui échoueront tant que les policies ne respecteront pas les portées.
4. **Pilotage** : `approval_requests_current_school` ne s'appuie pas sur `public.current_school_id()` mais sur un setting `app.current_school_id`, ce qui rompt l'alignement avec le modèle d'autorisation.
5. **Module Plateforme** : `file.upload` n'a pas de table cible dédiée avec RLS dans les migrations actuelles ; les tests se limitent à la vérification permission + condition.

## Commits

- `2463982` — `test(qa): add per-module RLS SQL tests with runner and Vitest wrapper`
