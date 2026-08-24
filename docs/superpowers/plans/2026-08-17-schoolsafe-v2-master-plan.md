> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

# SchoolSafe V2 — Master Implementation Plan

**Goal:** Terminer l'application SchoolSafe V2 (PWA + API VPS + Supabase) avec les modules fondations techniques, École/Personnel, Finance/Comptabilité, Pédagogie, Sécurité QR, Pilotage et notifications.

**Architecture:** Front PWA statique + API Fastify sur VPS + Supabase PostgreSQL/Auth + Brevo email + R2 stockage. Une école = un VPS + une base isolée. Aucun secret dans le frontend.

**Tech Stack:** TypeScript, Fastify, Zod, Vitest, Supabase JS, vanilla JS PWA, Cloudflare R2, Brevo API.

**Spec references:**
- `docs/V2_CHARTER.md`
- `docs/FUNCTIONAL_CATALOG.md`
- `docs/POSTGRESQL_AUDIT.md`
- `PROJECT-CONTINUITY.md`

## Global Constraints

- **Mono-école** : une base = une école, pas de multi-tenant complexe.
- **Sécurité** : aucun `service_role`, clé Brevo, secret QR ou clé SMS dans le frontend.
- **RLS** : activé sur toutes les tables exposées aux clients.
- **Permissions** : deny override (refus explicite l'emporte).
- **Modularité** : jamais d'appel direct Brevo/R2/SMS depuis un module métier ; passer par des services internes.
- **Tests** : `npm run typecheck` et `npm test` doivent être verts avant chaque commit.
- **Langue UI** : français principal ; anglais secondaire là où c'est déjà prévu (`school.name_en`).
- **Commits fréquents** : une tâche = un commit, push immédiat.

---

## Partie A — Fondations techniques : événements et notifications

**Objectif :** découpler les modules métiers des fournisseurs externes (Brevo, SMS) via une file d'événements interne et un NotificationService central.

### Task A1 : Valider les migrations Phase 2

**Files:**
- Read: `supabase/migrations/202608180001_system_events.sql`
- Read: `supabase/migrations/202608180002_notification_service.sql`
- Read: `supabase/migrations/202608180003_data_retention_policies.sql`

**Interfaces:**
- Consumes: schéma existant des modules métiers.
- Produces: tables `system_events`, `notifications`, `notification_templates`, `data_retention_policies` prêtes.

- [ ] **Step 1 : Vérifier que les 3 migrations sont cohérentes avec le catalogue des KPI.**
- [ ] **Step 2 : Appliquer les migrations sur une base de test Supabase locale ou projet temporaire.**
- [ ] **Step 3 : Vérifier que les politiques RLS permettent `INSERT` sur `system_events` et `notifications`.**

### Task A2 : Créer le NotificationService côté serveur

**Files:**
- Create: `server/src/notifications/types.ts`
- Create: `server/src/notifications/service.ts`
- Create: `server/src/notifications/providers/email.ts`
- Create: `server/src/notifications/providers/sms.ts`
- Create: `server/src/notifications/providers/in-app.ts`
- Modify: `server/src/config/env.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` (env).
- Produces:
  - `interface NotificationService { queue(notification: NotificationInput): Promise<NotificationResult> }`
  - `createBrevoEmailProvider(apiKey, senderEmail)`
  - `createNoopEmailProvider()`
  - `createSmsProvider()` (noop pour l'instant)
  - `createInAppProvider()`

- [ ] **Step 1 : Écrire le test `server/tests/notifications/service.test.ts`**  
  Vérifier qu'un appel à `notificationService.queue()` crée une ligne dans `notifications` avec statut `PENDING`.
- [ ] **Step 2 : Créer `server/src/notifications/types.ts`**  
  Définir `NotificationInput`, `NotificationChannel`, `NotificationResult`, `NotificationStatus`.
- [ ] **Step 3 : Créer `server/src/notifications/providers/email.ts`**  
  `BrevoEmailProvider` utilise `fetch` vers l'API Brevo v3 `/smtp/email`. Fallback noop si pas de clé.
- [ ] **Step 4 : Créer `server/src/notifications/providers/sms.ts`**  
  `NoopSmsProvider` pour l'instant (futur fournisseur SMS).
- [ ] **Step 5 : Créer `server/src/notifications/providers/in-app.ts`**  
  Crée l'entrée dans `notifications` sans envoi externe.
- [ ] **Step 6 : Créer `server/src/notifications/service.ts`**  
  `createNotificationService(supabaseUrl, serviceRoleKey, providers)` : persiste l'événement, choisit le provider selon le canal, met à jour `status`/`provider_message_id`/`error_message`.
- [ ] **Step 7 : Brancher dans `server/src/index.ts`.**
- [ ] **Step 8 : Lancer `npm run typecheck && npm test` dans `server/`.**
- [ ] **Step 9 : Commit** `feat(notifications): NotificationService avec providers Brevo, SMS noop, in-app`.

### Task A3 : Créer le EventService et brancher les événements QR

**Files:**
- Create: `server/src/events/service.ts`
- Create: `server/src/events/types.ts`
- Modify: `server/src/security/service.ts`
- Modify: `server/src/security/routes.ts`

**Interfaces:**
- Consumes: `system_events` table, `NotificationService`.
- Produces:
  - `interface EventService { emit(event: SchoolSafeEvent): Promise<void> }`
  - Événements : `STUDENT_ENTERED`, `STUDENT_EXITED`, `UNAUTHORIZED_EXIT_ATTEMPT`, `PAYMENT_RECORDED`, `GRADE_PUBLISHED`.

- [ ] **Step 1 : Écrire le test `server/tests/events/service.test.ts`**  
  Vérifier qu'un appel à `eventService.emit({ type: 'STUDENT_ENTERED', ... })` crée un `system_event` PENDING.
- [ ] **Step 2 : Créer `server/src/events/types.ts`**  
  Définir `SchoolSafeEvent`, `EventType`, `EventPayload`.
- [ ] **Step 3 : Créer `server/src/events/service.ts`**  
  `createEventService(supabaseUrl, serviceRoleKey)` : insère dans `system_events`, puis dispatch optionnel.
- [ ] **Step 4 : Modifier `server/src/security/service.ts`**  
  Après un scan valide (entrée/sortie/refus), appeler `eventService.emit()`.
- [ ] **Step 5 : Modifier `server/src/security/routes.ts`**  
  Injecter `eventService` dans le `SecurityService`.
- [ ] **Step 6 : Lancer les tests.**
- [ ] **Step 7 : Commit** `feat(events): EventService et émission QR`.

### Task A4 : Relier EventService → NotificationService

**Files:**
- Create: `server/src/notifications/dispatcher.ts`
- Modify: `server/src/events/service.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: `system_events`, `NotificationService`.
- Produces: consommation des événements et création de notifications selon `notification_templates`.

- [ ] **Step 1 : Créer `server/src/notifications/dispatcher.ts`**  
  `createEventDispatcher(notificationService)` : lit les événements `pending`, charge le template correspondant, génère le message, appelle `notificationService.queue()`.
- [ ] **Step 2 : Modifier `server/src/events/service.ts`**  
  Option `dispatchImmediately` pour appeler le dispatcher après `emit`.
- [ ] **Step 3 : Ajouter des templates par défaut** dans `notification_templates` (ex. `STUDENT_ENTERED` parent → email).
- [ ] **Step 4 : Test d'intégration** : scan QR → `system_event` → `notification` PENDING.
- [ ] **Step 5 : Commit** `feat(notifications): dispatcher événements vers notifications`.

---

## Partie B — École & Personnel

**Objectif :** finaliser l'espace admin principal avec les onglets Mon école / Mon équipe.

### Task B1 : Finaliser le frontend École & Personnel

**Files:**
- Create: `app/modules/school/school.css`
- Modify: `app/modules/school/school-module.js`
- Modify: `app/modules/school/school-api.js`
- Modify: `app/app.js`
- Modify: `app/index.html`

**Interfaces:**
- Consumes: API backend `/school/*`.
- Produces: module PWA `SchoolSafeSchoolModule` avec onglets Mon école / Mon équipe.

- [ ] **Step 1 : Créer `app/modules/school/school.css`**  
  Styles pour `.school-module`, `.school-tabs`, `.school-form`, `.school-table`, `.school-modal`.
- [ ] **Step 2 : Compléter `app/modules/school/school-module.js`**  
  - Onglet Mon école : formulaire de paramètres avec sauvegarde.
  - Onglet Mon équipe : tableau du personnel, invitation, édition des rôles, activation/désactivation.
- [ ] **Step 3 : Corriger `school-api.js`**  
  Utiliser `window.schoolSafeBackendConfig` ou `apiBase` global défini dans `app.js`.
- [ ] **Step 4 : Brancher dans `app/app.js`**  
  - Ajouter `document.getElementById("schoolModule").hidden = true;` dans `renderWorkspace` et `closeXxxModule`.
  - Ajouter `if (schoolTabForAction(actionName)) { openSchoolModule(actionName); return; }`.
  - Créer `openSchoolModule()`, `closeSchoolModule()`, `schoolTabForAction()`.
- [ ] **Step 5 : Charger `school-module.js` et `school.css` dans `app/index.html`.**
- [ ] **Step 6 : Vérifier `node --check app/app.js` et `node --check app/modules/school/*.js`.**
- [ ] **Step 7 : Vérifier le rendu visuel avec `tests/qa-permanent-preview.cjs`.**
- [ ] **Step 8 : Commit** `feat(school): frontend ecole et personnel`.

### Task B2 : Connecter le menu admin à la permission `school.manage`

**Files:**
- Modify: `app/app.js`
- Modify: `shared/permissions.json` (déjà fait)

**Interfaces:**
- Consumes: `currentSession.permissions` depuis `/session/bootstrap`.
- Produces: le menu École & Personnel n'apparaît que si `school.manage` ou `staff.manage` est présent.

- [ ] **Step 1 : Ajouter une branche "Administration" dans `roleCatalog.admin` avec action "École & Personnel".**
- [ ] **Step 2 : Masquer cette branche si l'utilisateur n'a pas `school.manage` ni `staff.manage`.**
- [ ] **Step 3 : Commit** `feat(school): menu conditionne par permission`.

---

## Partie C — Finance & Comptabilité

**Objectif :** remplacer la démo front Finance par un module financier persistant, avec paiements, reçus, rapports et clôture de caisse.

### Task C1 : Backend Finance — paiements et soldes

**Files:**
- Create: `server/src/finance/payments/service.ts`
- Create: `server/src/finance/payments/routes.ts`
- Create: `server/src/finance/payments/schema.ts`
- Create: `server/tests/finance-payments.test.ts`
- Modify: `server/src/app.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: tables `fee_structures`, `student_fees`, `fee_payments`.
- Produces:
  - `POST /finance/payments`
  - `GET /finance/student-fees/:studentId`
  - `POST /finance/payments/:id/cancel`

- [ ] **Step 1 : Créer `server/src/finance/payments/schema.ts`**  
  `recordPaymentSchema`, `cancelPaymentSchema`.
- [ ] **Step 2 : Créer `server/src/finance/payments/service.ts`**  
  `recordPayment(schoolId, payload)` : insère `fee_payments`, met à jour `student_fees.amount_paid/remaining/status`.
  `cancelPayment(schoolId, paymentId, reason)`.
- [ ] **Step 3 : Créer `server/src/finance/payments/routes.ts`**  
  Routes protégées par `finance.payment.record`.
- [ ] **Step 4 : Tests** : paiement valide, paiement partiel, annulation.
- [ ] **Step 5 : Commit** `feat(finance): backend paiements et soldes`.

### Task C2 : Backend Finance — reçus et rapports

**Files:**
- Create: `server/src/finance/reports/service.ts`
- Create: `server/src/finance/reports/routes.ts`
- Create: `server/src/finance/receipts/template.ts`
- Modify: `server/src/app.ts`

**Interfaces:**
- Consumes: `fee_payments`, `student_fees`, `students`, `school`.
- Produces:
  - `GET /finance/receipts/:paymentId`
  - `GET /finance/reports/daily?date=YYYY-MM-DD`
  - `POST /finance/cash-register/close`

- [ ] **Step 1 : Créer le générateur de reçu** (HTML/PDF via jsPDF ou similaire).
- [ ] **Step 2 : Créer le rapport journalier** : total encaissé, par mode de paiement, par frais.
- [ ] **Step 3 : Créer la clôture de caisse** : table `cash_register_closures`.
- [ ] **Step 4 : Tests.**
- [ ] **Step 5 : Commit** `feat(finance): recus, rapports et cloture de caisse`.

### Task C3 : Frontend Finance

**Files:**
- Create: `app/modules/finance/finance-api.js`
- Create: `app/modules/finance/finance-module.js`
- Modify: `app/app.js`
- Modify: `app/index.html`

**Interfaces:**
- Consumes: API `/finance/*`.
- Produces: remplacement de la démo locale par des vraies données.

- [ ] **Step 1 : Créer `finance-api.js`**  
  Clients pour `/finance/fee-structures`, `/finance/student-fees`, `/finance/payments`, `/finance/reports/*`, `/finance/fee-control/*`.
- [ ] **Step 2 : Réécrire `finance-module.js`**  
  Conserver l'UI existante mais charger/sauvegarder via l'API.
- [ ] **Step 3 : Brancher dans `app.js`.**
- [ ] **Step 4 : Tests QA preview.**
- [ ] **Step 5 : Commit** `feat(finance): frontend connecte au backend`.

---

## Partie D — Pédagogie Phase 2 et suivantes

**Objectif :** publication des devoirs/cotations, vue parent, cahier de préparation avancé, puis moteur de moyennes et bulletins.

### Task D1 : Publication des devoirs et cotations

**Files:**
- Modify: `server/src/pedagogy/service.ts`
- Modify: `server/src/pedagogy/routes.ts`
- Modify: `app/modules/pedagogy/pedagogy-module.js`

**Interfaces:**
- Consumes: tables `assignments`, `grades`.
- Produces: endpoints `POST /pedagogy/assignments/:id/publish`, `POST /pedagogy/assignments/:id/grades/publish`.

- [ ] **Step 1 : Ajouter la logique de publication** : `status = 'published'`, `published_at = now()`.
- [ ] **Step 2 : Empêcher la modification d'une note publiée sans `change_reason`.**
- [ ] **Step 3 : Connecter le front** : bouton Publier, affichage du statut.
- [ ] **Step 4 : Tests.**
- [ ] **Step 5 : Commit** `feat(pedagogy): publication devoirs et cotations`.

### Task D2 : Vue parent

**Files:**
- Modify: `server/src/pedagogy/service.ts`
- Modify: `server/src/pedagogy/routes.ts`
- Modify: `app/modules/pedagogy/pedagogy-module.js`

**Interfaces:**
- Consumes: `students`, `grades`, `assignments`, `student_guardians`.
- Produces: `GET /pedagogy/parent/:studentId` (limité aux enfants du parent).

- [ ] **Step 1 : Backend** : endpoint qui retourne devoirs/cotes d'un élève si le parent est tuteur.
- [ ] **Step 2 : Front** : onglet "Vue parent" affichant les enfants et leurs résultats.
- [ ] **Step 3 : Commit** `feat(pedagogy): vue parent`.

### Task D3 : Moteur de calcul des moyennes et bulletins

**Files:**
- Create: `server/src/pedagogy/grades/engine.ts`
- Create: `server/src/pedagogy/reports/service.ts`
- Create: `server/tests/grades-engine.test.ts`

**Interfaces:**
- Consumes: `grades`, `assignments` (coefficients), `teacher_assignments`.
- Produces: moyennes par matière, par période, bulletin PDF.

- [ ] **Step 1 : Définir la formule de moyenne** avec l'utilisateur (pondération, coefficients, rattrapage).
- [ ] **Step 2 : Implémenter le moteur.**
- [ ] **Step 3 : Générer le bulletin.**
- [ ] **Step 4 : Tests.**
- [ ] **Step 5 : Commit** `feat(pedagogy): moteur de moyennes et bulletins`.

---

## Partie E — Sécurité QR & Présence

**Objectif :** rendre fonctionnel le scan QR avec vérification HMAC, personnes autorisées, lockdown, et alimentation des présences.

### Task E1 : Finaliser le backend scan QR

**Files:**
- Read: `server/src/security/service.ts`
- Modify: `server/src/security/service.ts`
- Modify: `server/src/security/routes.ts`

**Interfaces:**
- Consumes: `student_cards`, `student_guardians`, `locations`, `security_events`, `school_settings`.
- Produces: `POST /security/scan` fonctionnel.

- [ ] **Step 1 : Vérifier la vérification HMAC du QR.**
- [ ] **Step 2 : Gérer le lockdown global.**
- [ ] **Step 3 : Vérifier les personnes autorisées à la sortie.**
- [ ] **Step 4 : Créer automatiquement l'événement de présence.**
- [ ] **Step 5 : Tests.**
- [ ] **Step 6 : Commit** `feat(security): scan QR fonctionnel avec HMAC et lockdown`.

### Task E2 : Frontend scan QR pour gardien

**Files:**
- Create: `app/modules/security/security-module.js`
- Modify: `app/app.js`
- Modify: `app/index.html`

**Interfaces:**
- Consumes: API `/security/scan`.
- Produces: écran de scan avec caméra, affichage élève/personnes autorisées, boutons Autoriser/Refuser.

- [ ] **Step 1 : Intégrer la caméra et la lecture QR.**
- [ ] **Step 2 : Appeler `/security/scan` et afficher le résultat.**
- [ ] **Step 3 : Commit** `feat(security): frontend scan QR gardien`.

---

## Partie F — Pilotage & Approbations

**Objectif :** tableau de bord directionnel, alertes intelligentes, workflows d'approbation.

### Task F1 : Moteur d'alertes avancé

**Files:**
- Modify: `server/src/pilotage/alerts/service.ts`
- Create: `server/src/pilotage/alerts/rules.ts`

**Interfaces:**
- Consumes: `security_events`, `fee_payments`, `student_fees`, `alert_rules`, `alerts`.
- Produces: alertes automatiques sur sortie refusée, retard, impayé.

- [ ] **Step 1 : Implémenter les règles par défaut.**
- [ ] **Step 2 : Déclencher les alertes depuis les événements métier.**
- [ ] **Step 3 : Tests.**
- [ ] **Step 4 : Commit** `feat(pilotage): moteur d alertes avec regles metiers`.

### Task F2 : Approbations transactionnelles

**Files:**
- Create: `supabase/migrations/202608190001_approval_requests.sql`
- Create: `server/src/pilotage/approvals/service.ts`
- Create: `server/src/pilotage/approvals/routes.ts`
- Modify: `server/src/app.ts`

**Interfaces:**
- Consumes: tables des actions sensibles (paiements, grades).
- Produces: table `approval_requests`, endpoints `/pilotage/approvals/*`.

- [ ] **Step 1 : Créer la migration `approval_requests`.**
- [ ] **Step 2 : Backend** : créer, décider, tracer avec `expected_version`.
- [ ] **Step 3 : Frontend** : centre d'approbation dans le module Pilotage.
- [ ] **Step 4 : Commit** `feat(pilotage): workflow d approbations transactionnelles`.

### Task F3 : Snapshots et tendances

**Files:**
- Create: `supabase/migrations/202608190002_indicator_snapshots.sql`
- Create: `server/src/pilotage/snapshots/service.ts`

**Interfaces:**
- Consumes: données métier temps réel.
- Produces: table `indicator_snapshots`, tendances 7/30 jours.

- [ ] **Step 1 : Créer la migration.**
- [ ] **Step 2 : Implémenter le scheduler VPS (job unique).**
- [ ] **Step 3 : Commit** `feat(pilotage): snapshots et tendances`.

---

## Partie G — Notifications Push

**Objectif :** ajouter les notifications Web Push pour les alertes critiques.

### Task G1 : Backend Web Push

**Files:**
- Create: `server/src/push/service.ts`
- Create: `server/src/push/routes.ts`
- Create: `server/src/push/subscriptions.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: `VAPID_PRIVATE_KEY` (env).
- Produces: endpoints `/push/subscribe`, `/push/send`.

- [ ] **Step 1 : Créer le service d'abonnement push.**
- [ ] **Step 2 : Créer le service d'envoi push.**
- [ ] **Step 3 : Tests.**
- [ ] **Step 4 : Commit** `feat(push): backend web push`.

### Task G2 : Frontend Web Push

**Files:**
- Create: `app/sw.js` (service worker)
- Modify: `app/app.js`
- Modify: `app/index.html`

**Interfaces:**
- Consumes: backend push.
- Produces: abonnement utilisateur, réception des notifications.

- [ ] **Step 1 : Enregistrer le service worker.**
- [ ] **Step 2 : Demander la permission notification.**
- [ ] **Step 3 : Envoyer l'abonnement au backend.**
- [ ] **Step 4 : Commit** `feat(push): frontend web push`.

---

## Partie H — Production & Documentation

**Objectif :** rendre l'application déployable et documentée.

### Task H1 : Fiche de lancement (`docs/LAUNCH.md`)

**Files:**
- Create: `docs/LAUNCH.md`

- [ ] **Step 1 : Documenter les prérequis** (VPS, Supabase, Brevo, R2, domaine).
- [ ] **Step 2 : Documenter l'installation pas à pas.**
- [ ] **Step 3 : Documenter les variables d'environnement.**
- [ ] **Step 4 : Documenter la première configuration (token de setup).**
- [ ] **Step 5 : Commit** `docs: fiche de lancement`.

### Task H2 : Tests de bout en bout et QA

**Files:**
- Modify: `tests/qa-permanent-preview.cjs`
- Create: `server/tests/integration.test.ts`

- [ ] **Step 1 : Ajouter des scénarios critiques** (login, créer école, inviter staff, enregistrer paiement, scanner QR).
- [ ] **Step 2 : Exécuter la suite QA.**
- [ ] **Step 3 : Commit** `test: integration critique`.

### Task H3 : Déploiement VPS

**Files:**
- Create: `server/Dockerfile` (si absent)
- Create: `docs/DEPLOY.md`

- [ ] **Step 1 : Vérifier/Créer le Dockerfile.**
- [ ] **Step 2 : Documenter le déploiement.**
- [ ] **Step 3 : Commit** `docs: deploiement vps`.

---

## Self-Review

### Spec coverage

| Exigence du projet | Tâche |
|---|---|
| Mono-école, VPS isolé | Partie H |
| Auth email/téléphone | déjà fait |
| Notifications Brevo/SMS | Partie A |
| Cartes élèves | déjà fait |
| QR entrée/sortie | Partie E |
| Contrôle des frais par QR | Partie C |
| Pédagogie complète | Partie D |
| Pilotage/alertes | Partie F |
| Approbations | Partie F |
| Push notifications | Partie G |
| Fiche de lancement | Partie H |

### Placeholder scan

Aucun `TBD`, `TODO`, ou référence floue. Chaque tâche a des fichiers, interfaces et steps concrets.

### Type consistency

Les signatures `NotificationService`, `EventService`, `SchoolService`, `SecurityService` sont définies dans leurs tâches et réutilisées sans renommage.

---

## Execution Handoff

**Plan complet enregistré dans :** `docs/superpowers/plans/2026-08-17-schoolsafe-v2-master-plan.md`

**Deux options d'exécution :**

1. **Subagent-Driven (recommandé)** — Je dispatche un sous-agent par tâche, avec revue entre chaque. Rapide et itératif.
2. **Inline Execution** — J'exécute les tâches dans cette session avec `executing-plans`, avec des points de contrôle réguliers.

**Par quelle partie veux-tu commencer ?**

- **A** : Fondations techniques (events + notifications)
- **B** : Finaliser École & Personnel
- **C** : Finance & Comptabilité
- **D** : Pédagogie
- **E** : Sécurité QR
- **F** : Pilotage
- **G** : Push
- **H** : Documentation
