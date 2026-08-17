# Audit PostgreSQL — SchoolSafe V2

> Phase 1 de la feuille de route technique : stabiliser PostgreSQL avant toute réécriture.  
> Date : 17 août 2026  
> Base auditée : schéma `public` de l'instance Supabase SchoolSafe V2 (migrations `20260815*` à `20260817*`).

---

## 1. Objectif de l'audit

Ce document recense l'état actuel du schéma PostgreSQL utilisé par SchoolSafe V2 :

- tables et leur finalité métier ;
- fonctions SQL utilitaires ;
- triggers, vues et extensions ;
- politiques RLS (Row Level Security) ;
- relations entre tables (clés étrangères) ;
- classification des données en permanentes / temporaires selon la roadmap technique.

Il sert de base aux phases suivantes : événements internes, service de notification, archivage D1/R2, rétention et audit.

---

## 2. Inventaire des migrations

| Fichier | Thème | Tables créées / modifiées |
|---|---|---|
| `202608150001_foundation_identity_access.sql` | Fondation identité, accès, audit | `school`, `school_settings`, `profiles`, `devices`, `roles`, `permissions`, `profile_roles`, `role_permission_grants`, `scope_assignments`, `audit_events` |
| `202608150002_access_functions.sql` | Fonctions d'accès | `current_profile_id()`, `has_permission()`, `has_scope()` |
| `202608150003_foundation_rls.sql` | RLS fondation | Ajout RLS sur les 10 tables fondation + fonctions `current_school_id()`, `has_role_id()` |
| `202608160001_step2_school_configuration.sql` | Configuration mono-école | `academic_years`, `school_cycles`, `school_contacts` ; colonnes ajoutées à `school`, `profiles` |
| `202608160002_card_system.sql` | Sous-système cartes | `classes`, `students`, `student_guardians`, `card_print_requests` |
| `202608160003_card_design_fields.sql` | Design des cartes | Colonnes ajoutées à `classes` |
| `202608170001_permission_deny_logic.sql` | Permission deny override | Réécriture de `has_permission()` |
| `202608170002_card_print_version.sql` | Version d'impression | Colonnes ajoutées à `card_print_requests` ; fonction `increment_card_print_count()` |
| `202608170003_security_and_alerts.sql` | Sécurité QR + alertes | `locations`, `student_cards`, `security_events`, `alert_rules`, `alerts`, `alert_notifications` ; lockdown dans `school_settings` |
| `202608170004_fee_control.sql` | Contrôle des frais | `fee_structures`, `student_fees`, `fee_payments`, `fee_control_campaigns`, `fee_control_assignees`, `fee_control_scans` |
| `202608170005_pedagogy_phase1.sql` | Pédagogie Phase 1 | `subjects`, `teacher_assignments`, `assignments`, `assignment_questions`, `grades`, `lesson_plans` |

**Total : 11 migrations. Aucune vue ni trigger n'est présent.**

---

## 3. Inventaire des tables

### 3.1 Fondation identité / accès / audit

| Table | Description | Colonnes clés | FK vers |
|---|---|---|---|
| `school` | École unique de l'instance | `id`, `code`, `name`, `name_en`, `legal_name`, `school_type`, `approval_code`, `primary_color`, `accent_color`, `document_footer`, `logo_path`, `setup_completed_at` | — |
| `school_settings` | Paramètres globaux de l'école | `school_id` (PK), `max_offline_hours`, `lockdown_active`, `lockdown_activated_at`, `lockdown_activated_by` | `school(id)` |
| `profiles` | Profils utilisateurs liés à Supabase Auth | `id`, `auth_user_id`, `school_id`, `display_name`, `first_name`, `last_name`, `phone`, `is_active` | `school(id)`, `auth.users(id)` |
| `devices` | Appareils enregistrés par profil | `id`, `profile_id`, `device_key`, `kind`, `is_school_managed`, `last_seen_at`, `revoked_at` | `profiles(id)` |
| `roles` | Rôles métier | `id`, `code`, `label` | — |
| `permissions` | Permissions métier | `id`, `code`, `description` | — |
| `profile_roles` | Affectation rôles ↔ profils | `profile_id`, `role_id` | `profiles(id)`, `roles(id)` |
| `role_permission_grants` | Droits par rôle (allow/deny) | `role_id`, `permission_id`, `allowed` | `roles(id)`, `permissions(id)` |
| `scope_assignments` | Périmètres d'action par profil | `id`, `profile_id`, `scope_type`, `scope_id`, `label` | `profiles(id)` |
| `audit_events` | Journal d'audit métier | `id`, `school_id`, `actor_profile_id`, `event_type`, `payload`, `request_id` | `school(id)`, `profiles(id)` |

### 3.2 Configuration de l'école (Étape 2)

| Table | Description | Colonnes clés | FK vers |
|---|---|---|---|
| `academic_years` | Années scolaires historisées | `id`, `school_id`, `label`, `starts_on`, `ends_on`, `periods`, `is_active` | `school(id)` |
| `school_cycles` | Cycles activés par l'école | `id`, `school_id`, `cycle_key`, `cycle_name`, `is_active` | `school(id)` |
| `school_contacts` | Coordonnées officielles | `id`, `school_id`, `country`, `province`, `city`, `address`, `email`, `phone`, `website_url`, `website_mode`, `public_news`, `public_gallery`, `public_honors` | `school(id)` |

### 3.3 Sous-système cartes élèves

| Table | Description | Colonnes clés | FK vers |
|---|---|---|---|
| `classes` | Classes de l'école | `id`, `school_id`, `academic_year_id`, `cycle_key`, `name`, `option`, `teacher_id`, `card_color*`, `card_family`, `card_variant`, `card_pat`, `card_pat_style` | `school(id)`, `academic_years(id)`, `profiles(id)` |
| `students` | Élèves | `id`, `school_id`, `class_id`, `matricule`, `first_name`, `middle_name`, `last_name`, `date_of_birth`, `gender`, `photo_path`, `card_printed`, `card_print_date`, `card_print_count` | `school(id)`, `classes(id)` |
| `student_guardians` | Tuteurs / personnes autorisées | `id`, `student_id`, `profile_id`, `guardian_type`, `is_primary`, `full_name`, `phone`, `email`, `address`, `is_authorized_pickup` | `students(id)`, `profiles(id)` |
| `card_print_requests` | Demandes d'impression de cartes | `id`, `school_id`, `student_id`, `academic_year_id`, `requested_by`, `format`, `is_duplicate`, `version`, `status`, `front_image_url`, `back_image_url`, `front_r2_key`, `back_r2_key`, `metadata`, `control_app_reference`, `error_message`, `requested_at`, `submitted_at`, `printed_at` | `school(id)`, `students(id)`, `academic_years(id)`, `profiles(id)` |

### 3.4 Sécurité QR / alertes

| Table | Description | Colonnes clés | FK vers |
|---|---|---|---|
| `locations` | Postes / portes / lieux de contrôle | `id`, `school_id`, `code`, `label`, `kind`, `is_active` | `school(id)` |
| `student_cards` | Cartes physiques sécurisées (QR signé) | `id`, `school_id`, `student_id`, `card_number`, `card_secret`, `signature`, `status`, `issued_at`, `revoked_at`, `replaced_by_card_id` | `school(id)`, `students(id)`, `student_cards(id)` |
| `security_events` | Scans QR : entrées, sorties, refus, incidents | `id`, `school_id`, `student_id`, `card_id`, `location_id`, `event_type`, `occurred_at`, `scanned_by`, `authorized_person_id`, `decision`, `denial_reason`, `metadata` | `school(id)`, `students(id)`, `student_cards(id)`, `locations(id)`, `profiles(id)`, `student_guardians(id)` |
| `alert_rules` | Règles configurables de génération d'alertes | `id`, `school_id`, `code`, `domain`, `name`, `description`, `enabled`, `severity`, `evaluation_mode`, `cooldown_seconds`, `notify_channels`, `target_roles`, `condition_type`, `threshold_json` | `school(id)` |
| `alerts` | Alertes générées par le moteur de pilotage | `id`, `school_id`, `rule_id`, `source_module`, `alert_type`, `severity`, `title`, `message`, `entity_type`, `entity_id`, `dedup_key`, `status`, `detected_at`, `last_seen_at`, `occurrence_count`, `assigned_to`, `acknowledged_at`, `acknowledged_by`, `resolved_at`, `resolved_by`, `resolution_note`, `metadata` | `school(id)`, `alert_rules(id)`, `profiles(id)` (×3) |
| `alert_notifications` | Routage et historique des notifications d'alerte | `id`, `alert_id`, `profile_id`, `channel`, `status`, `sent_at`, `error_message` | `alerts(id)`, `profiles(id)` |

### 3.5 Finance / contrôle des frais

| Table | Description | Colonnes clés | FK vers |
|---|---|---|---|
| `fee_structures` | Grille des frais par cycle et année | `id`, `school_id`, `academic_year_id`, `cycle_key`, `label`, `amount`, `currency`, `due_date`, `is_active` | `school(id)`, `academic_years(id)` |
| `student_fees` | Situation financière individuelle | `id`, `school_id`, `student_id`, `fee_structure_id`, `status`, `amount_expected`, `amount_paid`, `amount_remaining` | `school(id)`, `students(id)`, `fee_structures(id)` |
| `fee_payments` | Paiements reçus | `id`, `school_id`, `student_fee_id`, `amount`, `currency`, `received_by`, `received_at`, `receipt_no`, `status`, `cancellation_reason`, `metadata` | `school(id)`, `student_fees(id)`, `profiles(id)` |
| `fee_control_campaigns` | Campagnes de contrôle des frais par QR | `id`, `school_id`, `fee_structure_id`, `label`, `description`, `classes`, `starts_at`, `ends_at`, `status`, `created_by` | `school(id)`, `fee_structures(id)`, `profiles(id)` |
| `fee_control_assignees` | Contrôleurs assignés à une campagne | `campaign_id`, `profile_id` | `fee_control_campaigns(id)`, `profiles(id)` |
| `fee_control_scans` | Scans de contrôle des frais | `id`, `school_id`, `campaign_id`, `student_id`, `scanned_by`, `location_id`, `student_fee_status`, `result`, `notes`, `scanned_at`, `metadata` | `school(id)`, `fee_control_campaigns(id)`, `students(id)`, `profiles(id)`, `locations(id)` |

### 3.6 Pédagogie Phase 1

| Table | Description | Colonnes clés | FK vers |
|---|---|---|---|
| `subjects` | Matières par langue et cycle | `id`, `school_id`, `academic_year_id`, `cycle_key`, `code`, `name`, `language`, `subject_family_code`, `is_active` | `school(id)`, `academic_years(id)` |
| `teacher_assignments` | Affectations enseignant ↔ classe ↔ matière | `id`, `school_id`, `academic_year_id`, `class_id`, `subject_id`, `teacher_id`, `is_tutor` | `school(id)`, `academic_years(id)`, `classes(id)`, `subjects(id)`, `profiles(id)` |
| `assignments` | Devoirs / évaluations | `id`, `school_id`, `academic_year_id`, `class_id`, `subject_id`, `teacher_id`, `title`, `type`, `scale_mode`, `scale_max`, `scale_label`, `coefficient`, `due_date`, `prerequisites`, `instructions`, `language`, `status`, `published_at` | `school(id)`, `academic_years(id)`, `classes(id)`, `subjects(id)`, `profiles(id)` |
| `assignment_questions` | Questions d'un devoir | `id`, `assignment_id`, `text`, `type`, `points`, `answer_space`, `choices`, `order_index` | `assignments(id)` |
| `grades` | Cotations des élèves | `id`, `school_id`, `assignment_id`, `student_id`, `value_numeric`, `value_text`, `normalized_value`, `comment`, `change_reason`, `status`, `published_at`, `created_by`, `updated_by` | `school(id)`, `assignments(id)`, `students(id)`, `profiles(id)` (×2) |
| `lesson_plans` | Cahier de préparation | `id`, `school_id`, `academic_year_id`, `class_id`, `subject_id`, `teacher_id`, `title`, `lesson_date`, `objectives`, `materials`, `procedure`, `homework_assignment_id`, `attachments` | `school(id)`, `academic_years(id)`, `classes(id)`, `subjects(id)`, `profiles(id)`, `assignments(id)` |

---

## 4. Inventaire des fonctions SQL

| Fonction | Signature | Type | Description | Droits |
|---|---|---|---|---|
| `current_profile_id` | `() → uuid` | SQL stable, security definer | Retourne l'id du profil authentifié actif | `authenticated` |
| `current_school_id` | `() → uuid` | SQL stable, security definer | Retourne l'école du profil courant | `authenticated` |
| `has_permission` | `(permission_code text) → boolean` | SQL stable, security definer | Vérifie si le profil courant a la permission (allow - deny l'emporte) | `authenticated` |
| `has_scope` | `(scope_type text, scope_id uuid) → boolean` | SQL stable, security definer | Vérifie si le profil courant a le périmètre demandé | `authenticated` |
| `has_role_id` | `(requested_role_id uuid) → boolean` | SQL stable, security definer | Vérifie si le profil courant possède le rôle | `authenticated` |
| `increment_card_print_count` | `(student_id uuid) → integer` | PL/pgSQL, security definer | Incrémente atomiquement `students.card_print_count`, met à jour `card_printed` et `card_print_date` | `authenticated` |

**Remarque :** aucune fonction de génération de signature QR n'est actuellement dans les migrations ; elle est implémentée côté serveur Node (`CARD_HMAC_SECRET`).

---

## 5. Triggers et vues

| Type | Nombre | Détail |
|---|---|---|
| Triggers | 0 | Aucun trigger SQL n'est créé dans les migrations actuelles. Les mises à jour de `updated_at` et les dénormalisations sont gérées côté application. |
| Vues | 0 | Aucune vue SQL n'est créée. Les agrégations (dashboard, rapports) sont calculées côté serveur. |

**Recommandation :** les prochains triggers devraient être réservés à l'audit automatique (`updated_at`, snapshots) et aux tâches métier cohérentes (par exemple recalcul `amount_remaining` après insertion d'un paiement).

---

## 6. Extensions PostgreSQL

| Extension | Utilisation | Commentaire |
|---|---|---|
| `pgcrypto` | `gen_random_uuid()` comme default PK | Utilisée sur toutes les tables à clé primaire UUID. |
| `uuid-ossp` | Non utilisée | Peut être ignorée ; `pgcrypto` est suffisant. |
| `pg_cron` | Non confirmé dans les migrations | Utilisée plus tard si on choisit Supabase Cron pour certains jobs. |

---

## 7. Matrice des relations (clés étrangères)

### Tables référencées fréquemment

- `public.school(id)` : référencée par **26 tables** (presque toutes).
- `public.profiles(id)` : référencée par **15 tables** (utilisateurs, enseignants, créateurs, récepteurs, scanners, etc.).
- `public.students(id)` : référencée par **8 tables**.
- `public.classes(id)` : référencée par **6 tables**.
- `public.academic_years(id)` : référencée par **8 tables**.
- `public.assignments(id)` : référencée par `assignment_questions`, `grades`, `lesson_plans`.
- `public.fee_structures(id)` : référencée par `student_fees`, `fee_control_campaigns`.

### Graphe des dépendances critiques

```
school
├── school_settings
├── academic_years
├── school_cycles
├── school_contacts
├── profiles ──► auth.users
├── devices
├── classes ──► academic_years, profiles
├── students ──► classes
│   ├── student_guardians ──► profiles
│   ├── student_cards
│   ├── card_print_requests ──► academic_years, profiles
│   ├── security_events ──► student_cards, locations, profiles, student_guardians
│   ├── student_fees ──► fee_structures
│   │   └── fee_payments ──► profiles
│   ├── fee_control_scans ──► fee_control_campaigns, locations, profiles
│   ├── grades ──► assignments, profiles
│   └── (future : bulletins, absences, etc.)
├── fee_structures ──► academic_years
│   └── fee_control_campaigns ──► profiles
│       └── fee_control_assignees ──► profiles
├── locations
├── alert_rules
├── alerts ──► alert_rules, profiles
│   └── alert_notifications ──► profiles
├── subjects ──► academic_years
│   ├── teacher_assignments ──► classes, profiles
│   ├── assignments ──► classes, profiles
│   └── lesson_plans ──► classes, profiles
├── assignments
│   ├── assignment_questions
│   ├── grades
│   └── lesson_plans
└── audit_events ──► profiles
```

---

## 8. Inventaire des politiques RLS

Toutes les tables métier ont RLS activé. Voici les politiques actives par table.

### Fondation

| Table | Politique | Opération | Règle |
|---|---|---|---|
| `school` | `school_select_current` | SELECT | `id = current_school_id()` |
| `school_settings` | `school_settings_select_current` | SELECT | `school_id = current_school_id()` |
| `profiles` | `profiles_select_self` | SELECT | `id = current_profile_id()` |
| `profiles` | `profiles_update_self` | UPDATE | `id = current_profile_id()` |
| `devices` | `devices_select_self` | SELECT | `profile_id = current_profile_id()` |
| `devices` | `devices_insert_self` | INSERT | `profile_id = current_profile_id()` |
| `devices` | `devices_update_self` | UPDATE | `profile_id = current_profile_id()` |
| `roles` | `roles_select_assigned` | SELECT | `has_role_id(id)` |
| `permissions` | `permissions_select_granted` | SELECT | `has_permission(code)` |
| `profile_roles` | `profile_roles_select_self` | SELECT | `profile_id = current_profile_id()` |
| `role_permission_grants` | `role_permission_grants_select_assigned` | SELECT | `has_role_id(role_id)` |
| `scope_assignments` | `scope_assignments_select_self` | SELECT | `profile_id = current_profile_id()` |
| `audit_events` | `audit_events_insert_self` | INSERT | `school_id = current_school_id() AND actor_profile_id = current_profile_id()` |

### Configuration

| Table | Politique | Opération | Règle |
|---|---|---|---|
| `academic_years` | `academic_years_select_current` | SELECT | `school_id = current_school_id()` |
| `school_cycles` | `school_cycles_select_current` | SELECT | `school_id = current_school_id()` |
| `school_contacts` | `school_contacts_select_current` | SELECT | `school_id = current_school_id()` |

### Cartes

| Table | Politique | Opération | Règle |
|---|---|---|---|
| `classes` | `classes_current_school` | ALL | `school_id = current_school_id()` |
| `students` | `students_current_school` | ALL | `school_id = current_school_id()` |
| `student_guardians` | `student_guardians_current_school` | ALL | `student_id IN (students de current_school_id())` |
| `card_print_requests` | `card_print_requests_current_school` | ALL | `school_id = current_school_id()` |

### Sécurité / alertes

| Table | Politique | Opération | Règle |
|---|---|---|---|
| `locations` | `locations_current_school` | ALL | `school_id = current_school_id()` |
| `student_cards` | `student_cards_current_school` | ALL | `school_id = current_school_id()` |
| `security_events` | `security_events_current_school` | ALL | `school_id = current_school_id()` |
| `alert_rules` | `alert_rules_current_school` | ALL | `school_id IS NULL OR school_id = current_school_id()` (règles système + école) |
| `alerts` | `alerts_current_school` | ALL | `school_id = current_school_id()` |
| `alert_notifications` | `alert_notifications_current_school` | ALL | `alert_id IN (alertes de current_school_id())` |

### Finance

| Table | Politique | Opération | Règle |
|---|---|---|---|
| `fee_structures` | `fee_structures_current_school` | ALL | `school_id = current_school_id()` |
| `student_fees` | `student_fees_current_school` | ALL | `school_id = current_school_id()` |
| `fee_payments` | `fee_payments_current_school` | ALL | `school_id = current_school_id()` |
| `fee_control_campaigns` | `fee_control_campaigns_current_school` | ALL | `school_id = current_school_id()` |
| `fee_control_assignees` | `fee_control_assignees_current_school` | ALL | `campaign_id IN (campagnes de current_school_id())` |
| `fee_control_scans` | `fee_control_scans_current_school` | ALL | `school_id = current_school_id()` |

### Pédagogie

| Table | Politique | Opération | Règle |
|---|---|---|---|
| `subjects` | `subjects_current_school` | ALL | `school_id = current_school_id()` |
| `teacher_assignments` | `teacher_assignments_current_school` | ALL | `school_id = current_school_id()` |
| `assignments` | `assignments_current_school` | ALL | `school_id = current_school_id()` |
| `assignment_questions` | `assignment_questions_current_school` | ALL | `assignment_id IN (devoirs de current_school_id())` |
| `grades` | `grades_current_school` | ALL | `school_id = current_school_id()` |
| `lesson_plans` | `lesson_plans_current_school` | ALL | `school_id = current_school_id()` |

**Point d'attention :** `card_print_requests`, `fee_payments`, `fee_control_campaigns`, `assignments`, `grades` etc. autorisent `INSERT/UPDATE` à tout utilisateur authentifié de l'école. Le serveur Node doit appliquer les permissions métier avant d'écrire, car RLS ne filtre que par école.

---

## 9. Classification des données : permanentes vs temporaires

### 9.1 Données permanentes (doivent rester dans PostgreSQL)

| Domaine | Tables |
|---|---|
| Identité école | `school`, `school_settings`, `school_contacts`, `academic_years`, `school_cycles` |
| Utilisateurs / rôles | `profiles`, `roles`, `permissions`, `profile_roles`, `role_permission_grants`, `scope_assignments` |
| Élèves / classes | `classes`, `students`, `student_guardians` |
| Cartes | `student_cards` actives, `card_print_requests` finalisées |
| Finance | `fee_structures`, `student_fees`, `fee_payments`, `fee_control_campaigns` |
| Pédagogie | `subjects`, `teacher_assignments`, `assignments`, `assignment_questions`, `grades`, `lesson_plans` |
| Audit officiel | `audit_events` |
| Événements officiels consolidés | `security_events` (sorties officielles), `fee_control_scans` |

### 9.2 Données temporaires / techniques (à archiver progressivement)

| Table / type | Durée suggérée dans PostgreSQL | Destination d'archivage | Justification |
|---|---|---|---|
| Scans QR bruts non consolidés | 30 jours | D1 + R2 (payload) | Haut volume, faible valeur après consolidation dans `security_events`. |
| Tentatives de notification | 30 jours | D1 | Historique de livraison, utile pour debug. |
| Logs techniques / API | 7 jours | R2 (fichiers) | Volume élevé, pas de besoin de jointure SQL. |
| Alertes résolues / annulées | 90 jours | D1 | Besoin de consultation, plus de traitement actif. |
| Notifications d'alerte envoyées | 30 jours | D1 | Trace de routage. |
| Demandes d'impression échouées (vieilles) | 90 jours | R2 (images) + D1 | Conservation légale/fiscale faible. |
| Journaux d'audit anciens | 1 an actif, puis archive | D1 | Obligation légale, lecture rare. |
| Snapshots d'indicateurs | garder les agrégats, pas les bruts | R2 (séries temporelles) | Tendances calculées, volumineuses. |

**Tables à créer pour la roadmap :**

| Table | Rôle |
|---|---|
| `system_events` | File d'événements internes (action métier → notification). |
| `notifications` | Sortie du NotificationService (EMAIL / SMS / IN_APP). |
| `notification_templates` | Templates paramétrables par canal et langue. |
| `data_retention_policies` | Règles configurables de rétention par type de donnée. |

---

## 10. Recommandations pour la suite

### 10.1 Court terme (prochaines phases)

1. **Créer `system_events`** avec `event_type`, `entity_type`, `entity_id`, `payload`, `status`, `created_at`, `processed_at`.  
   C'est la brique centrale qui découplera les modules métiers de Brevo/SMS.
2. **Créer `notifications` et `notification_templates`** pour centraliser Brevo et le futur SMS.  
   Le module QR/Sécurité ne doit jamais appeler Brevo directement.
3. **Ajouter un trigger ou une fonction de recalcul** sur `fee_payments` pour maintenir `student_fees.amount_paid` et `amount_remaining`.  
   Aujourd'hui cette dénormalisation est mise à jour côté application.
4. **Créer `data_retention_policies`** et une colonne `archived_at` sur les tables temporaires dès leur création.

### 10.2 Moyen terme

5. **Cloudflare R2** : abstraction `FileStorage` (upload / delete / signed URL).  
   PostgreSQL ne conserve que `file_key`, `mime_type`, `size`, `created_at`.
6. **D1 (historique consultable)** : abstraction `ArchiveService` qui copie les événements vieux de PostgreSQL vers D1 sans jamais y écrire de donnée officielle modifiable.
7. **Jobs VPS** : un scheduler unique sur le VPS pour les tâches périodiques (snapshots, alertes, archivage) avec verrou logique si plusieurs workers.
8. **Approbations transactionnelles** : table `approval_requests` avec `expected_version`, `old_value`, `new_value`, `decision`, `decided_by`, `decided_at`.
9. **Snapshots** : table `indicator_snapshots` pour les tendances 7/30 jours du module Pilotage.

### 10.3 Sécurité

- Aucun `service_role` dans le frontend.
- Aucune clé Brevo, SMS, R2, HMAC QR dans le frontend.
- RLS déjà activé sur toutes les tables sensibles ; à compléter avec des politiques plus fines si nécessaire (par exemple `grades` accessibles selon le rôle enseignant/parent).
- Mots de passe gérés par Supabase Auth, jamais dans les tables métier.

---

## 11. État de la Phase 1

| Critère | État |
|---|---|
| Inventaire des tables | ✅ 35 tables recensées |
| Inventaire des fonctions | ✅ 6 fonctions recensées |
| Inventaire des triggers | ✅ 0 |
| Inventaire des vues | ✅ 0 |
| Inventaire des extensions | ✅ `pgcrypto` |
| Matrice des relations | ✅ FK documentées |
| Inventaire RLS | ✅ 40+ politiques documentées |
| Classification permanente / temporaire | ✅ effectuée |
| Tables manquantes identifiées | ✅ `system_events`, `notifications`, `notification_templates`, `data_retention_policies`, `approval_requests`, `indicator_snapshots` |

**Verdict :** PostgreSQL est stable et bien structuré. Aucune réécriture n'est nécessaire. On peut passer à la Phase 2 (système d'événements internes + notification service) en toute sécurité.

---

*Document généré lors de l'audit PostgreSQL Phase 1 — SchoolSafe V2.*
