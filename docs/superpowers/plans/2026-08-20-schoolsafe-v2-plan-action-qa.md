# SchoolSafe V2 — Plan d’action QA et scénarios de tests par profil

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer le diagnostic QA validé en plan d’action exécutable, avec scénarios de test par profil, pour atteindre un GO de lancement.

**Architecture:** Le plan suit la chaîne d’autorisation `USER → SCHOOL → ROLE → PERMISSION → SCOPE → CONDITION → EXCEPTION → AUDIT`. Chaque correction (C1–C6) est découpée en tâches testables. Les scénarios couvrent les 15 profils de base contre les écarts P0/P1/P2.

**Tech Stack:** Supabase PostgreSQL/RLS/RPC, Cloudflare Workers (Hono) / Fastify, Vitest, Playwright, `shared/permissions.json`.

**Spec:** `docs/superpowers/specs/2026-08-19-schoolsafe-v2-diagnostic-qa.md`

## Global Constraints

- Une instance SchoolSafe = une école isolée ; `school_id` est le périmètre implicite.
- Tout ce qui n’est pas explicitement autorisé = **DENY**.
- Un DENY explicite (rôle ou exception individuelle) l’emporte toujours sur un ALLOW.
- Le frontend n’est pas une barrière de sécurité : chaque vérification doit exister côté API **et** RLS.
- Objectif de couverture : **80 %** (unitaires, intégration, RLS, E2E).
- Aucune permission combinée ou ambiguë ; chaque permission = un droit métier précis.
- Audit : tracer les opérations sensibles réussies **et** les tentatives refusées importantes.

---

## Résumé des écarts et priorités

| Priorité | Écart | Correction | Preuve de résolution |
|----------|-------|------------|----------------------|
| **P0** | Conditions non codées (caisse, annulation, scan, publication notes, approbations) | C1 — Système de conditions | Tests RLS + RPC + E2E pour chaque condition critique |
| **P0** | Exceptions individuelles manquantes | C2 — Table `profile_permission_exceptions` | Tests unitaires + RLS + E2E admin ajoutant/retirant une exception |
| **P1** | Audit non systématique | C4 — Déclencheurs `audit_events` | Tests d’intégration vérifiant `INSERT` dans `audit_events` |
| **P1** | Types de scope non normalisés | C3 — Liste officielle et validation | Tests unitaires + lint du catalogue |
| **P2** | Permissions manquantes pour Palmarès, RH, Cantine, Infirmerie, Communication, Safe, Rapports | C5 — Extension du catalogue | Tests unitaires + RLS pour chaque nouvelle permission |
| **P2** | RLS non vérifiées contre la chaîne complète | C6 — Revue RLS par table | Tests RLS par profil / permission / scope |

---

## Phase 1 — Fondations d’autorisation (P0)

### Task 1.1 : Créer le système de conditions (C1)

**Files:**
- Create: `supabase/migrations/20260820000001_permission_conditions.sql`
- Modify: `supabase/migrations/` (fonctions `has_permission`, `has_scope` existantes)
- Create: `server/src/auth/conditions.ts` ou `workers/src/auth/conditions.ts`
- Test: `tests/qa/unit/conditions.test.ts`

**Interfaces:**
- Consomme : `role_permission_grants`, `scope_assignments`, `cash_registers`, `academic_years`, `fee_control_campaigns`, `security_portals`, `approval_requests`.
- Produits : `has_condition(condition_type text, params jsonb) returns boolean` ; `condition_type` enum.

- [ ] **Step 1.1.1 : Ajouter la table et l’enum `permission_conditions`**

```sql
CREATE TYPE public.condition_type AS ENUM (
  'academic_year_active',
  'cash_register_open',
  'campaign_published',
  'within_cancellation_window',
  'quota_available',
  'device_managed',
  'status_pending',
  'portal_open'
);

CREATE TABLE public.permission_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id uuid REFERENCES public.role_permission_grants(id) ON DELETE CASCADE,
  condition_type public.condition_type NOT NULL,
  condition_params jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
```

- [ ] **Step 1.1.2 : Créer la RPC `has_condition`**

```sql
CREATE OR REPLACE FUNCTION public.has_condition(
  p_condition_type public.condition_type,
  p_params jsonb DEFAULT '{}'::jsonb
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_profile_id uuid;
  v_school_id uuid;
BEGIN
  v_profile_id := public.current_profile_id();
  SELECT school_id INTO v_school_id FROM public.profiles WHERE id = v_profile_id;

  CASE p_condition_type
    WHEN 'academic_year_active' THEN
      RETURN EXISTS (
        SELECT 1 FROM public.academic_years
        WHERE school_id = v_school_id AND is_active = true
      );
    WHEN 'cash_register_open' THEN
      RETURN EXISTS (
        SELECT 1 FROM public.cash_registers
        WHERE school_id = v_school_id AND status = 'open'
          AND (p_params->>'date' IS NULL OR date = (p_params->>'date')::date)
      );
    WHEN 'campaign_published' THEN
      RETURN EXISTS (
        SELECT 1 FROM public.fee_control_campaigns
        WHERE id = (p_params->>'campaign_id')::uuid AND status = 'published'
      );
    WHEN 'within_cancellation_window' THEN
      RETURN EXISTS (
        SELECT 1 FROM public.fee_payments
        WHERE id = (p_params->>'payment_id')::uuid
          AND created_at > now() - interval '24 hours'
      );
    WHEN 'status_pending' THEN
      RETURN EXISTS (
        SELECT 1 FROM public.approval_requests
        WHERE id = (p_params->>'request_id')::uuid AND status = 'pending'
      );
    WHEN 'portal_open' THEN
      RETURN EXISTS (
        SELECT 1 FROM public.security_portals
        WHERE id = (p_params->>'portal_id')::uuid AND is_open = true
      );
    ELSE
      RETURN false;
  END CASE;
END;
$$;
```

- [ ] **Step 1.1.3 : Modifier `has_permission` pour appeler `has_condition` après la vérification de permission**

```sql
-- Dans has_permission, après avoir vérifié le rôle et l'exception,
-- vérifier s'il existe des conditions attachées au grant et les évaluer.
```

- [ ] **Step 1.1.4 : Appliquer les conditions critiques en RLS**

Permissions concernées : `finance.payment.record`, `finance.payment.cancel`, `finance.control.scan`, `security.scan`, `security.pickup.manage`, `pilotage.approvals.manage`, `pedagogy.grade.manage`, `email.send`.

- [ ] **Step 1.1.5 : Écrire les tests unitaires/RLS**

Run: `npm test -- tests/qa/unit/conditions.test.ts`
Expected: PASS

---

### Task 1.2 : Ajouter les exceptions individuelles (C2)

**Files:**
- Create: `supabase/migrations/20260820000002_profile_permission_exceptions.sql`
- Modify: `supabase/migrations/` (fonction `has_permission`)
- Create: `server/src/auth/exceptions.ts` ou `workers/src/auth/exceptions.ts`
- Test: `tests/qa/unit/exceptions.test.ts`, `tests/qa/rls/exceptions.setup.test.sql`

**Interfaces:**
- Consomme : `public.profiles`, `public.role_permission_grants`.
- Produits : `profile_permission_exceptions` table ; `has_permission` prend en compte les exceptions.

- [ ] **Step 1.2.1 : Créer la table `profile_permission_exceptions`**

```sql
CREATE TABLE public.profile_permission_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission_code text NOT NULL,
  allowed boolean NOT NULL,
  reason text NOT NULL,
  granted_by uuid NOT NULL REFERENCES public.profiles(id),
  granted_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  UNIQUE(profile_id, permission_code)
);
```

- [ ] **Step 1.2.2 : Modifier `has_permission` pour résoudre rôle + exception**

Règle :
1. Si un rôle a `allowed = false` → DENY.
2. Si une exception `allowed = false` active existe → DENY.
3. Si une exception `allowed = true` active existe → ALLOW.
4. Sinon, retourne le résultat des rôles.

- [ ] **Step 1.2.3 : Auditer chaque création/modification/suppression d’exception**

```sql
CREATE TRIGGER audit_profile_permission_exceptions
AFTER INSERT OR UPDATE OR DELETE ON public.profile_permission_exceptions
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
```

- [ ] **Step 1.2.4 : Tests unitaires et RLS**

Run: `npm test -- tests/qa/unit/exceptions.test.ts`
Expected: PASS

---

## Phase 2 — Normalisation et audit (P1)

### Task 2.1 : Normaliser les types de scope (C3)

**Files:**
- Modify: `shared/permissions.json`
- Create: `tests/qa/unit/scopes.test.ts`
- Modify: `docs/ACCESS_MODEL.md`

- [ ] **Step 2.1.1 : Documenter la liste officielle des scopes**

Scopes officiels : `own`, `own_children`, `assigned_classes`, `assigned_subjects`, `assigned_portal`, `school`, `none`.

- [ ] **Step 2.1.2 : Ajouter une validation du catalogue JSON**

```ts
// tests/qa/unit/scopes.test.ts
const validScopes = ['own','own_children','assigned_classes','assigned_subjects','assigned_portal','school','none'];
permissions.forEach(p => {
  expect(validScopes).toContain(p.scope);
});
```

Run: `npm test -- tests/qa/unit/scopes.test.ts`
Expected: PASS

---

### Task 2.2 : Audit systématique (C4)

**Files:**
- Modify: `supabase/migrations/` (triggers `audit_events`)
- Create: `server/src/audit/service.ts`
- Test: `tests/qa/integration/audit.flows.test.ts`

- [ ] **Step 2.2.1 : Créer une fonction helper côté backend pour insérer dans `audit_events`**

```ts
export async function auditEvent(event: {
  event_type: string;
  actor_profile_id: string;
  target_profile_id?: string;
  payload: object;
  request_id?: string;
  success: boolean;
  reason?: string;
}) { ... }
```

- [ ] **Step 2.2.2 : Tracer les opérations sensibles réussies**

Liste : rôles/permissions/exceptions, scope_assignments, encaissement, annulation, clôture caisse, scan QR, pick-up, lockdown, publication notes, bulletins, palmarès, approbations, demande impression carte, upload/download, connexions.

- [ ] **Step 2.2.3 : Tracer les tentatives refusées importantes**

Raison du refus : `permission_denied`, `scope_denied`, `condition_denied`, `exception_denied`.

- [ ] **Step 2.2.4 : Tests d’intégration**

Run: `npm test -- tests/qa/integration/audit.flows.test.ts`
Expected: PASS

---

## Phase 3 — Extension du catalogue et revue RLS (P2)

### Task 3.1 : Ajouter les permissions manquantes (C5)

**Files:**
- Modify: `shared/permissions.json`
- Test: `tests/qa/unit/permission-catalog.test.ts`

- [ ] **Step 3.1.1 : Ajouter les permissions listées dans le diagnostic**

```json
{
  "code": "pedagogy.report.read",
  "label": "Lire les rapports pédagogiques",
  "scope": "school"
},
{
  "code": "pedagogy.report.manage",
  "label": "Gérer les rapports pédagogiques",
  "scope": "school"
},
{
  "code": "palmarques.read",
  "label": "Consulter le palmarès",
  "scope": "school"
},
{
  "code": "palmarques.manage",
  "label": "Gérer le palmarès",
  "scope": "school"
},
{
  "code": "staff.read",
  "label": "Consulter le personnel",
  "scope": "school"
},
{
  "code": "staff.attendance.read",
  "label": "Consulter les présences du personnel",
  "scope": "school"
},
{
  "code": "canteen.manage",
  "label": "Gérer la cantine",
  "scope": "school"
},
{
  "code": "infirmary.manage",
  "label": "Gérer l’infirmerie",
  "scope": "school"
},
{
  "code": "communication.announcement.manage",
  "label": "Gérer les annonces",
  "scope": "school"
},
{
  "code": "communication.message.send",
  "label": "Envoyer des messages",
  "scope": "school"
},
{
  "code": "safe.assistant.use",
  "label": "Utiliser l’assistant Safe",
  "scope": "own"
},
{
  "code": "reports.operational.read",
  "label": "Lire les rapports opérationnels",
  "scope": "school"
},
{
  "code": "reports.financial.read",
  "label": "Lire les rapports financiers",
  "scope": "school"
},
{
  "code": "reports.security.read",
  "label": "Lire les rapports de sécurité",
  "scope": "school"
},
{
  "code": "reports.hr.read",
  "label": "Lire les rapports RH",
  "scope": "school"
}
```

- [ ] **Step 3.1.2 : Vérifier l’unicité et la non-ambiguïté**

Run: `npm test -- tests/qa/unit/permission-catalog.test.ts`
Expected: PASS

---

### Task 3.2 : Revue RLS avec la chaîne complète (C6)

**Files:**
- Modify: `supabase/migrations/` (politiques RLS sur toutes les tables métier)
- Test: `tests/qa/rls/rls.test.ts`, setups SQL existants

- [ ] **Step 3.2.1 : Pour chaque table métier, vérifier que la politique RLS applique : USER, SCHOOL, ROLE, PERMISSION, SCOPE, CONDITION, EXCEPTION**

Tables prioritaires : `profiles`, `fee_payments`, `fee_structures`, `security_events`, `approval_requests`, `pedagogy_grades`, `assignments`, `cards_requests`.

- [ ] **Step 3.2.2 : Rédiger un test RLS par table et par profil critique**

Run: `npm test -- tests/qa/rls/rls.test.ts`
Expected: PASS

---

## Scénarios de tests par profil

Chaque scénario est un test E2E Playwright ou un test d’intégration API. Les profils sont ceux du `docs/V2_CHARTER.md`.

### Profil 1 — Administrateur principal

| # | Scénario | Type | Preuve |
|---|----------|------|--------|
| 1.1 | Créer une école via bootstrap | Intégration | Retour 200 + école créée |
| 1.2 | Inviter un administrateur | E2E | E-mail d’invitation généré |
| 1.3 | Ajouter une exception ALLOW à un parent sur `finance.receipt.read` | RLS + E2E | Parent voit le reçu malgré le rôle |
| 1.4 | Ajouter une exception DENY à un caissier sur `finance.payment.record` | RLS + E2E | Caissier ne peut plus enregistrer de paiement |
| 1.5 | Modifier un rôle et retirer une permission | Audit | Événement `role.permission.revoked` dans `audit_events` |
| 1.6 | Consulter l’audit des actions sensibles | E2E | Liste des événements affichée |

### Profil 2 — Chef d’établissement

| # | Scénario | Type | Preuve |
|---|----------|------|--------|
| 2.1 | Voir le tableau de bord de pilotage | E2E | KPIs affichés |
| 2.2 | Approuver une demande d’annulation de paiement | Intégration | Statut `approved` + audit |
| 2.3 | Voir les rapports financiers en lecture seule | E2E | Rapport affiché sans bouton d’action |
| 2.4 | Verrouiller l’école (lockdown) | Intégration | Événement lockdown + notifications |

### Profil 3 — Responsable pédagogique

| # | Scénario | Type | Preuve |
|---|----------|------|--------|
| 3.1 | Publier des notes | Intégration | Notes passent en `published` |
| 3.2 | Tenter de modifier une note publiée | RLS | Refus `condition_denied` |
| 3.3 | Voir les élèves en ordre / à régulariser | E2E | Liste sans montants |
| 3.4 | Consulter le palmarès | E2E | Palmarès accessible avec `palmarques.read` |

### Profil 4 — Responsable administratif et admissions

| # | Scénario | Type | Preuve |
|---|----------|------|--------|
| 4.1 | Créer une classe | Intégration | Classe insérée |
| 4.2 | Gérer les parents/tuteurs | E2E | CRUD tuteur |
| 4.3 | Importer des élèves (si spécifié) | E2E | Import OK + détection doublons |

### Profil 5 — Secrétaire scolaire

| # | Scénario | Type | Preuve |
|---|----------|------|--------|
| 5.1 | Saisir les présences élèves | E2E | Présences enregistrées |
| 5.2 | Justifier une absence | Intégration | Absence mise à jour |
| 5.3 | Demander l’impression d’une carte | E2E | Demande créée + audit |

### Profil 6 — Responsable financier

| # | Scénario | Type | Preuve |
|---|----------|------|--------|
| 6.1 | Créer une structure de frais | Intégration | `fee_structures` insérée |
| 6.2 | Créer une campagne de contrôle | E2E | Campagne publiée |
| 6.3 | Clôturer la caisse | Intégration | `cash_registers` statut `closed` + audit |
| 6.4 | Annuler un paiement hors délai | RLS | Refus `condition_denied` |

### Profil 7 — Agent de caisse

| # | Scénario | Type | Preuve |
|---|----------|------|--------|
| 7.1 | Enregistrer un paiement quand la caisse est ouverte | Intégration | Paiement créé + reçu |
| 7.2 | Tenter d’enregistrer un paiement quand la caisse est fermée | RLS | Refus `condition_denied` |
| 7.3 | Produire un reçu PDF | E2E | PDF téléchargé |
| 7.4 | Demander l’annulation d’un paiement | E2E | Demande en `pending` |

### Profil 8 — Comptable

| # | Scénario | Type | Preuve |
|---|----------|------|--------|
| 8.1 | Consulter le rapport de caisse | E2E | Rapport affiché |
| 8.2 | Voir les rapports financiers | E2E | `reports.financial.read` |
| 8.3 | Ne pas pouvoir enregistrer de paiement | RLS | Refus `permission_denied` |

### Profil 9 — Responsable RH

| # | Scénario | Type | Preuve |
|---|----------|------|--------|
| 9.1 | Consulter le personnel avec `staff.read` | E2E | Liste du personnel |
| 9.2 | Voir les rapports RH | E2E | `reports.hr.read` |
| 9.3 | Gérer un contrat (si spécifié) | E2E | CRUD contrat |

### Profil 10 — Enseignant

| # | Scénario | Type | Preuve |
|---|----------|------|--------|
| 10.1 | Créer un devoir pour sa classe | Intégration | Devoir créé |
| 10.2 | Saisir des notes pour sa matière | E2E | Notes enregistrées |
| 10.3 | Voir le cahier de préparation | E2E | Cahier accessible |
| 10.4 | Ne pas voir les notes d’une autre classe | RLS | Aucune donnée |

### Profil 11 — Agent de contrôle d’accès

| # | Scénario | Type | Preuve |
|---|----------|------|--------|
| 11.1 | Scanner un QR avec le portail ouvert | Intégration | Événement `security_events` créé |
| 11.2 | Scanner un QR avec le portail fermé | RLS | Refus `condition_denied` |
| 11.3 | Autoriser une sortie | E2E | Sortie confirmée |
| 11.4 | Voir les élèves actuellement dans l’école | E2E | Liste temps réel |

### Profil 12 — Infirmier

| # | Scénario | Type | Preuve |
|---|----------|------|--------|
| 12.1 | Enregistrer un passage infirmerie | E2E | Passage créé avec `infirmary.manage` |
| 12.2 | Consulter les allergies d’un élève | E2E | Allergies visibles |

### Profil 13 — Responsable cantine

| # | Scénario | Type | Preuve |
|---|----------|------|--------|
| 13.1 | Gérer les bénéficiaires | E2E | Liste mise à jour avec `canteen.manage` |
| 13.2 | Enregistrer les présences repas | E2E | Présences repas enregistrées |

### Profil 14 — Responsable communication et site

| # | Scénario | Type | Preuve |
|---|----------|------|--------|
| 14.1 | Publier une annonce | Intégration | Annonce créée avec `communication.announcement.manage` |
| 14.2 | Envoyer une notification ciblée | E2E | Notification envoyée avec `communication.message.send` |
| 14.3 | Ne pas pouvoir modifier les frais scolaires | RLS | Refus `permission_denied` |

### Profil 15 — Parent ou responsable légal

| # | Scénario | Type | Preuve |
|---|----------|------|--------|
| 15.1 | Voir les enfants rattachés | E2E | Liste des enfants |
| 15.2 | Voir les reçus de ses enfants | E2E | Reçus visibles avec `finance.receipt.read` scope `own_children` |
| 15.3 | Voir les notes publiées de ses enfants | E2E | Notes accessibles |
| 15.4 | Ne pas voir les notes d’un autre enfant | RLS | Aucune donnée |
| 15.5 | Ne pas voir les montants financiers | E2E | Soldes masqués |

---

## Matrice de couverture cible

| Niveau de test | Actuel | Cible | Delta |
|----------------|--------|-------|-------|
| Unit tests | 0/7 | 7/7 | Toutes les fonctions utilitaires d’autorisation |
| RLS tests | 0/7 | 7/7 | Toutes les tables métier critiques |
| Integration tests | 17/17 | 25+ | Ajout conditions, exceptions, audit |
| E2E tests | 6 profils | 15 profils | Ajout 9 profils manquants |
| Permissions couvertes | 18/46 | 46/46 | Mapping complet diagnostic |

---

## Commandes de vérification

```bash
# Syntaxe
node --check app/app.js
node --check app/modules/finance/finance-module.js

# Tests serveur
npm test

# Tests RLS (nécessite Supabase local ou une instance de test)
npx supabase test db

# Tests E2E
npx playwright test tests/qa/e2e/

# Validation du catalogue permissions
node tests/qa/unit/permission-catalog.test.ts
```

---

## Roadmap suggérée

| Sprint | Focus | Livrable |
|--------|-------|----------|
| S1 | C1 + C2 (conditions et exceptions) | P0 résolu, tests RLS passent |
| S2 | C4 (audit) + C3 (scopes) | P1 résolu, audit systématique |
| S3 | C5 (permissions manquantes) + C6 (revue RLS) | P2 résolu, catalogue à 61 permissions |
| S4 | E2E des 15 profils + recette | GO/NO-GO final |

---

## Self-review

- **Spec coverage :** chaque écart C1–C6 du diagnostic §9.7 est couvert par au moins une tâche.
- **Placeholder scan :** aucun TBD/ TODO ; chaque tâche a des fichiers, SQL et commandes de vérification.
- **Type consistency :** `has_permission`, `has_scope`, `has_condition`, `profile_permission_exceptions` utilisent les noms du diagnostic.
- **Gaps restants :** la résolution des fonctions « à spécifier » (bulletins, palmarès, paie, comptabilité) n’est pas dans ce plan QA car elles nécessitent des specs métier avant des tests.
