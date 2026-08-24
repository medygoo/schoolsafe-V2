# SchoolSafe V2 — Guide de validation QA sur instance Supabase réelle

> Objectif : appliquer les corrections C1-C6 sur une base Supabase distante (pas de Docker/Supabase local), exécuter les tests QA et valider manuellement la chaîne d'autorisation complète.

---

## 1. Prérequis

- Un projet Supabase actif (URL + `anon key` + `service_role key`).
- La connection string PostgreSQL directe de ce projet (obtenue dans *Settings > Database > Connection string > URI*).
- La CLI Supabase installée (`supabase --version`) si vous choisissez la méthode A.
- `psql` ou un client PostgreSQL si vous choisissez la méthode B.
- Node.js ≥ 22 et les dépendances installées dans `server/` (`npm install`).

---

## 2. Sauvegarde obligatoire avant toute migration

Dans le dashboard Supabase :

1. Aller dans *Database > Backups*.
2. Déclencher un backup manuel (*Trigger backup*).
3. Attendre la confirmation avant de continuer.

> Ne jamais appliquer ces migrations en production sans backup validé.

---

## 3. Ordre des migrations C1-C6

Les migrations doivent être appliquées **strictement dans cet ordre** :

1. `20260820000001_permission_conditions.sql` — C1 : conditions sur les permissions.
2. `20260820000002_cancel_payment_condition.sql` — C2 : condition d'annulation de paiement.
3. `20260820000003_profile_permission_exceptions.sql` — C3 : exceptions individuelles.
4. `20260820000004_systematic_audit.sql` — C4 : audit systématique.
5. `20260820000005_rls_fixes.sql` — C5 : correctifs RLS intermédiaires.
6. `20260820000006_rls_chain_review.sql` — C6 : revue RLS complète.

---

## 4. Méthode A — Application via Supabase CLI (`supabase db push`)

Utilisez cette méthode si votre projet est lié à Supabase et que vous voulez que l'historique des migrations soit traçable.

```bash
# Lier le repo au projet Supabase distant (une seule fois)
supabase link --project-ref <votre-project-ref>

# Vérifier l'état des migrations
supabase migration list

# Pousser toutes les migrations en attente
supabase db push
```

Si certaines migrations sont déjà appliquées, `supabase db push` ne les réapplique pas. Pour forcer l'application d'une migration spécifique sans la marquer comme appliquée, utilisez plutôt la méthode B.

---

## 5. Méthode B — Application directe via `psql`

Utilisez cette méthode pour un contrôle total de l'ordre et pour valider sur un projet qui n'est pas lié localement.

```bash
export DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"

psql "$DATABASE_URL" -f supabase/migrations/20260820000001_permission_conditions.sql
psql "$DATABASE_URL" -f supabase/migrations/20260820000002_cancel_payment_condition.sql
psql "$DATABASE_URL" -f supabase/migrations/20260820000003_profile_permission_exceptions.sql
psql "$DATABASE_URL" -f supabase/migrations/20260820000004_systematic_audit.sql
psql "$DATABASE_URL" -f supabase/migrations/20260820000005_rls_fixes.sql
psql "$DATABASE_URL" -f supabase/migrations/20260820000006_rls_chain_review.sql
```

---

## 6. Vérification rapide post-migration

### 6.1 Tables et colonnes créées

```sql
-- C1 : conditions
select count(*) from information_schema.columns
where table_schema = 'public' and table_name = 'permission_conditions';
-- Résultat attendu : ≥ 5 colonnes

-- C3 : exceptions individuelles
select count(*) from information_schema.columns
where table_schema = 'public' and table_name = 'profile_permission_exceptions';

-- C4 : audit enrichi
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'audit_events'
order by ordinal_position;
-- Doit contenir : success, target_profile_id
```

### 6.2 Fonctions essentielles

```sql
select proname from pg_proc
where pronamespace = 'public'::regnamespace
and proname in ('has_permission', 'has_scope', 'has_condition', 'audit_event', 'check_cancellation_window');
-- Doit retourner les 5 fonctions
```

### 6.3 Politiques RLS restrictives

```sql
select schemaname, tablename, policyname, permissive
from pg_policies
where schemaname = 'public'
and policyname like '%permission_chain%'
order by tablename;
-- Doit lister les politiques restrictive créées en C6
```

---

## 7. Configuration des variables d'environnement pour les tests

Créez un fichier `server/.env.qa` (ne le versionnez pas) :

```bash
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
TEST_DATABASE_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
```

Puis chargez-le avant chaque commande de test :

```bash
set -a && source server/.env.qa && set -a
```

> Note : `TEST_DATABASE_URL` est nécessaire uniquement pour les tests RLS (`tests/qa/rls/`) qui utilisent `pg` directement.

---

## 8. Commandes de test QA

### 8.1 Tests unitaires et chaîne d'accès

Ces tests créent des écoles, profils, rôles et permissions temporaires sur l'instance Supabase distante, puis nettoient.

```bash
cd server/
set -a && source .env.qa && set -a
npm test -- tests/qa/unit/access-chain.test.ts
npm test -- tests/qa/unit/conditions.test.ts
npm test -- tests/qa/unit/exceptions.test.ts
npm test -- tests/qa/unit/scopes.test.ts
npm test -- tests/qa/unit/permission-catalog.test.ts
```

Pour tout exécuter d'un coup :

```bash
npm test -- tests/qa/unit
```

### 8.2 Tests RLS

Ces tests exécutent des scripts SQL directement via `pg` sur la base PostgreSQL distante.

```bash
cd server/
set -a && source .env.qa && set -a
npm test -- tests/qa/rls/rls.test.ts
```

### 8.3 Tests d'intégration

Ces tests fonctionnent en mémoire via le `buildIntegrationHarness`. Ils ne nécessitent pas de connexion Supabase mais valident le comportement des routes et services.

```bash
cd server/
npm test -- tests/qa/integration
```

### 8.4 Tests E2E Playwright

Ces tests nécessitent l'application frontend et le backend accessibles. À ne lancer que si l'application est déployée et que les migrations sont appliquées.

```bash
# Installer Playwright si ce n'est pas déjà fait
npx playwright install

# Configurer l'URL de l'application
export SCHOOLSAFE_BASE_URL=https://votre-instance.schoolsafe.app

npx playwright test tests/qa/e2e
```

### 8.5 Type checking

```bash
cd server/
npx tsc --noEmit -p tsconfig.json
```

Si un `tsconfig.qa.json` existe, exécutez aussi :

```bash
npx tsc --noEmit -p tsconfig.qa.json
```

---

## 9. Checklist de validation C1-C6

| ID | Livrable | Validation | Commentaire |
|----|----------|------------|-------------|
| C1 | `permission_conditions` existe | `\dt public.permission_conditions` | Table et enum `condition_type` présentes. |
| C1 | `has_condition` fonctionne | `select public.has_condition('finance.payment.cancel', 'within_cancellation_window'::public.condition_type, '{"hours":24}'::jsonb);` | Retourne `true` ou `false` sans erreur. |
| C2 | Condition d'annulation de paiement | Appeler `rpc('check_cancellation_window', ...)` sur un paiement récent puis ancien. | Récent = `true`, ancien = `false`. |
| C3 | `profile_permission_exceptions` existe | `\dt public.profile_permission_exceptions` | Colonnes : `profile_id`, `permission_id`, `allowed`, `reason`, `expires_at`. |
| C3 | Exception prioritaire | Donner `allowed = false` à un profil pour une permission autorisée par son rôle. `has_permission` doit retourner `false`. | DENY explicite prioritaire. |
| C4 | Colonnes `success` et `target_profile_id` dans `audit_events` | `\d public.audit_events` | Présentes et peuplées. |
| C4 | Tentative refusée loguée | Faire un appel refusé (permission manquante) et vérifier `select * from audit_events where success = false;`. | Au moins une ligne insérée. |
| C5 | Correctifs RLS intermédiaires | `select * from pg_policies where policyname like '%rls_fix%';` | Politiques actives. |
| C6 | Politiques restrictives `permission_chain` | `select * from pg_policies where policyname like '%permission_chain%';` | Présentes sur `school_settings`, `fee_payments`, `fee_structures`, `security_events`, etc. |
| C6 | Chaîne complète appliquée | Test manuel : utilisateur d'une autre école ne peut pas lire les profils étrangers. | Voir scénario §10.1. |

---

## 10. Scénarios de test manuel minimum

### 10.1 Isolement par école

1. Créer deux écoles `A` et `B` via le dashboard ou `service_role`.
2. Créer un utilisateur `userA` dans l'école `A`.
3. Connectez-vous avec `userA` (anon key).
4. `select * from profiles where school_id = '<B>';` → doit retourner 0 ligne.

### 10.2 DENY explicite

1. Créer un rôle `role_allow` avec `school.manage = true`.
2. Créer un rôle `role_deny` avec `school.manage = false`.
3. Attribuer les deux rôles à un utilisateur.
4. Appeler `select public.has_permission('school.manage');` → doit retourner `false`.

### 10.3 Scope `own_children`

1. Créer un profil parent avec rôle `parent`.
2. Insérer une ligne dans `scope_assignments` : `(profile_id, scope_type='own_children', scope_id='<enfant-id>')`.
3. Appeler `select public.has_scope('own_children', '<enfant-id>');` → `true`.
4. Appeler avec un autre enfant → `false`.

### 10.4 Condition d'annulation de paiement

1. Enregistrer un paiement frais à `created_at = now()`.
2. Appeler `check_cancellation_window(payment_id, 24)` → `true`.
3. Mettre à jour le paiement à `created_at = now() - interval '48 hours'`.
4. Appeler `check_cancellation_window(payment_id, 24)` → `false`.

### 10.5 Audit d'une tentative refusée

1. Essayer d'appeler une route sensible avec un utilisateur sans permission (via anon key).
2. Vérifier dans `audit_events` qu'un événement `access.denied` ou similaire a été inséré avec `success = false`.

---

## 11. Génération du rapport QA

Si un script de rapport existe, générez-le après les tests :

```bash
npx tsx tests/qa/generate-report.ts tests/qa/last-results.json
```

Sinon, collectez manuellement :

- Nombre de tests passés / total par couche (unit, rls, integration, e2e).
- Liste des écarts restants (P0/P1/P2).
- Recommandation de validation ou de correction.

---

## 12. Résultat attendu pour validation

Le diagnostic C1-C6 est considéré comme validé si et seulement si :

1. Les 6 migrations sont appliquées sans erreur.
2. Toutes les vérifications SQL du §6 retournent les résultats attendus.
3. Les tests unitaires QA passent (zéro échec sur `tests/qa/unit`).
4. Les tests RLS passent (zéro échec sur `tests/qa/rls`).
5. Les tests d'intégration passent (zéro échec sur `tests/qa/integration`).
6. Les 5 scénarios manuels du §10 sont concluants.
7. Aucune donnée de démonstration n'est exposée en mode production.

---

## 13. En cas d'erreur

1. Notez le message d'erreur exact et le numéro de migration concerné.
2. Vérifiez que les migrations précédentes ont bien été appliquées dans l'ordre.
3. Restaurez le backup créé au §2 si la base est dans un état incohérent.
4. Ne modifiez pas les migrations existantes : créez une nouvelle migration de correction si nécessaire.
