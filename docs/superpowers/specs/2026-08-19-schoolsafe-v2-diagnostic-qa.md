# SchoolSafe V2 — Diagnostic QA complet

**Date :** 2026-08-19  
**Statut :** Validé  
**Sources :** `docs/FUNCTIONAL_CATALOG.md`, `docs/V2_CHARTER.md`, `docs/ACCESS_MODEL.md`, `docs/superpowers/specs/2026-08-18-schoolsafe-v2-global-design.md`, `app/modules/`, `server/src/`, `workers/src/`, `shared/permissions.json`  
**Objectif :** Rassembler, organiser et qualifier l’ensemble des fonctionnalités et profils conçus depuis le début de SchoolSafe V2, afin d’établir une base de vérité pour le lancement et les phases suivantes.

---

## 1. Résumé exécutif

SchoolSafe V2 est une application par école, déployée sur Cloudflare Pages + Workers, avec Supabase PostgreSQL/Auth/RLS, Cloudflare R2 pour les fichiers, et une PWA fr/en. Le produit couvre l’administration scolaire, la pédagogie, la finance, la sécurité QR, le pilotage, la communication et la plateforme.

Ce diagnostic recense **15 modules métier** et **15 profils de base**, en classant chaque fonction selon son état de livraison réel. Il ne remplace pas les tests de production, mais fournit le cadre pour les préparer.

### Vue synthétique globale

| Module | État global | Profils principaux |
|--------|-------------|--------------------|
| Auth & setup | Partiel | Tous |
| École | Partiel | Admin, Chef, Resp. adm., Secrétaire |
| Personnel / RH | À spécifier | Admin, Resp. RH |
| Pédagogie | Partiel | Enseignant, Resp. pédagogique |
| Palmarès | À spécifier | Enseignant, Resp. pédagogique, Chef |
| Finance | Partiel | Resp. financier, Agent de caisse, Comptable |
| Contrôle | Partiel | Resp. financier, Agent de contrôle |
| Sécurité & accès QR | Partiel | Agent de contrôle d’accès, Sécurité |
| Pilotage | Partiel | Chef, Admin, Responsables |
| Communication | À spécifier | Resp. communication, Tous |
| Documents & rapports | Partiel | Tous selon permissions |
| Rapports opérationnels et indicateurs | Partiel | Chef, Admin, Responsables |
| Cartes | Partiel (sous-système protégé) | Admin, Agent de contrôle |
| Safe assistant | Spécifié | Tous |
| Plateforme | Partiel | Tous |

---

## 2. Méthodologie

### 2.1 Principes de classement

- Une instance SchoolSafe représente une seule école isolée.
- L’école n’est jamais un sélecteur de périmètre dans l’application.
- L’autorisation suit le modèle : `Rôle → Branche → Groupe métier → Permission → Action → Vue de données → Périmètre`.
- Un DENY explicite l’emporte toujours sur un ALLOW.
- L’interface ne constitue pas une barrière de sécurité : chaque fonction doit être revérifiée côté serveur et base (RLS/RPC).

### 2.2 Sources utilisées

| Source | Ce qu’elle apporte |
|--------|--------------------|
| `docs/FUNCTIONAL_CATALOG.md` | Liste fonctionnelle exhaustive par domaine. |
| `docs/V2_CHARTER.md` | Profils de référence, cycles configurables, patrimoine protégé. |
| `docs/ACCESS_MODEL.md` | Modèle d’autorisation (rôle, branche, permission, vue, périmètre). |
| `docs/superpowers/specs/2026-08-18-schoolsafe-v2-global-design.md` | Architecture cible Cloudflare + Supabase, état des modules. |
| `app/modules/` | Modules frontend existants (sécurité, pédagogie, école, finance, cartes, pilotage). |
| `server/src/` | Backend Fastify actuel (routes, services, schémas). |
| `workers/src/` | Backend cible Cloudflare Workers (Hono) en cours de portage. |
| `shared/permissions.json` | Catalogue actuel des 59 permissions. |
| `supabase/migrations/` | Schéma PostgreSQL, RLS, triggers, audit. |

### 2.3 Classification des états

Chaque fonction est classée selon l’un de ces états :

| État | Définition |
|------|------------|
| `implémenté` | Code frontend + backend + RLS/tests présents et raccordés. |
| `partiel` | Code existant mais manque un raccordement (backend, tests, RLS, UX, i18n). |
| `spécifié` | Documenté dans un spec/plan, pas encore codé. |
| `à spécifier` | Mentionné dans le catalogue, mais sans spec détaillé. |
| `hors périmètre v2` | Reporté ou non priorisé pour cette version. |

---

## 3. Profils de base de référence

Ces 15 profils sont définis dans `docs/V2_CHARTER.md`. L’administrateur principal peut créer des **profils personnalisés** à partir de ces modèles, mais les profils ci-dessous constituent les références de base.

| # | Profil | Rôle métier principal |
|---|--------|----------------------|
| 1 | **Administrateur principal** | Installation, configuration globale, audit, exceptions individuelles. |
| 2 | **Chef d’établissement** | Vision transversale, validation, pilotage. |
| 3 | **Responsable pédagogique** | Pédagogie, programmes, bulletins, palmarès. |
| 4 | **Responsable administratif et admissions** | Inscriptions, admissions, dossiers élèves, familles. |
| 5 | **Secrétaire scolaire** | Saisie quotidienne, présences, documents administratifs. |
| 6 | **Responsable financier** | Paramétrage des frais, supervision, clôture caisse. |
| 7 | **Agent de caisse** | Encaissements, reçus, recherche de paiement. |
| 8 | **Comptable** | Journal, grand livre, balance, écritures. |
| 9 | **Responsable RH** | Dossiers personnel, contrats, paie, présences. |
| 10 | **Enseignant** | Devoirs, notes, présences, cahier de préparation. |
| 11 | **Agent de contrôle d’accès** | Scan QR, entrées/sorties, vérification pick-up. |
| 12 | **Infirmier** | Passages infirmerie, incidents, allergies, traitements. |
| 13 | **Responsable cantine** | Bénéficiaires, présences repas, menus, allergies. |
| 14 | **Responsable communication et site** | Annonces, messagerie, site public, notifications. |
| 15 | **Parent ou responsable légal** | Consultation de ses enfants, paiements, messagerie. |

---

## 4. Inventaire par module métier

### 4.1 Auth & setup

**Objectif :** Gérer l’authentification, la récupération d’accès, l’installation initiale et l’invitation des administrateurs.

| # | Fonctionnalité | État | Profils | Permissions / fichiers clés | Notes |
|---|----------------|------|---------|----------------------------|-------|
| 1.1 | Connexion par e-mail | Partiel | Tous | `server/src/auth/session.ts` | JWT Supabase, récupération à finaliser. |
| 1.2 | Connexion par téléphone | Partiel | Tous | `server/src/auth/lookup-phone.ts` | OTP et canal de secours à finaliser. |
| 1.3 | Récupération d’accès | Partiel | Tous | `setup/routes.ts` | Procédure de secours admin à préciser. |
| 1.4 | Bootstrap initial | Implémenté | Admin principal | `server/src/bootstrap/`, `setup/` | Création école + admin. |
| 1.5 | Invitation d’administrateurs | Partiel | Admin principal | `server/src/setup/service.ts` | UX d’activation à affiner. |
| 1.6 | Gestion des sessions actives | À spécifier | Admin principal | — | Non abordé dans les specs actuelles. |

**État global :** Partiel. Les fondations existent ; les flux OTP, secours et activation doivent être finalisés.

---

### 4.2 École

**Objectif :** Gérer le référentiel de l’école : cycles, classes, matières, élèves, familles et inscriptions.

| # | Fonctionnalité | État | Profils | Permissions / fichiers clés | Notes |
|---|----------------|------|---------|----------------------------|-------|
| 2.1 | Cycles configurables | Implémenté | Admin, Chef | `V2_CHARTER.md` | Maternelle, Primaire, Secondaire, Humanités. |
| 2.2 | Classes et affectations | Partiel | Admin, Chef, Resp. adm., Secrétaire | `server/src/school/`, `app/modules/school/` | CRUD de base présent. |
| 2.3 | Matières | Partiel | Admin, Resp. pédagogique | `server/src/pedagogy/subject.*` | Lié à la pédagogie. |
| 2.4 | Dossier élève (matricule, classe, statut) | Partiel | Secrétaire, Resp. adm. | `server/src/school/service.ts` | Champs à compléter selon le pays. |
| 2.5 | Parents et responsables légaux | Partiel | Secrétaire, Resp. adm. | `school.guardian.read/manage` | Gestion des personnes autorisées au pick-up. |
| 2.6 | Préinscriptions et admissions | À spécifier | Resp. adm., Secrétaire | — | Mentionné dans `FUNCTIONAL_CATALOG.md`. |
| 2.7 | Réinscriptions | À spécifier | Secrétaire, Resp. adm. | — | À intégrer au cycle scolaire. |
| 2.8 | Import massif avec détection de doublons | À spécifier | Admin, Resp. adm. | — | À spécifier avant codage. |

**État global :** Partiel. Le socle existe, mais les flux d’admission, réinscription et import restent à spécifier.

---

### 4.3 Personnel / RH

**Objectif :** Gérer les employés de l’école : dossiers, contrats, affectations, présences et paie.

| # | Fonctionnalité | État | Profils | Permissions / fichiers clés | Notes |
|---|----------------|------|---------|----------------------------|-------|
| 3.1 | Dossiers du personnel | Partiel | Resp. RH, Admin | `staff.manage` | Schéma minimal existant. |
| 3.2 | Contrats | À spécifier | Resp. RH | — | Types de contrat, dates, pièces jointes. |
| 3.3 | Affectations et services | Partiel | Resp. RH, Admin | `school.manage`, `staff.manage` | Lié aux classes/matieres. |
| 3.4 | Présences du personnel | À spécifier | Resp. RH | — | Biométrie / pointage. |
| 3.5 | Absences, congés et autorisations | À spécifier | Resp. RH | — | Circuit d’approbation à définir. |
| 3.6 | Salaires, avances, primes et retenues | À spécifier | Resp. RH, Comptable | — | Règles de paie et fiscalité à spécifier. |
| 3.7 | Appareils biométriques | Hors périmètre v2 | Resp. RH | — | Raccordement à spécifier plus tard. |

**État global :** À spécifier. Seul le socle minimal existe ; la paie et la biométrie sont hors périmètre v2.

---

### 4.4 Pédagogie

**Objectif :** Gérer le cycle pédagogique : devoirs, notes, moyennes, bulletins, présences et cahier de préparation.

| # | Fonctionnalité | État | Profils | Permissions / fichiers clés | Notes |
|---|----------------|------|---------|----------------------------|-------|
| 4.1 | Cycles et classes | Implémenté | Admin, Resp. pédagogique | `server/src/school/`, `server/src/pedagogy/` | Réutilisé depuis École. |
| 4.2 | Matières et affectations enseignants | Partiel | Resp. pédagogique | `pedagogy.subject.*`, `pedagogy.assignment.*` | CRUD présent. |
| 4.3 | Emplois du temps | À spécifier | Resp. pédagogique, Enseignant | — | Non abordé dans les specs actuelles. |
| 4.4 | Présences élèves | Partiel | Enseignant, Secrétaire | `server/src/pedagogy/` | Justifications à finaliser. |
| 4.5 | Devoirs et remises | Partiel | Enseignant, Élève (vue parent) | `pedagogy.assignment.*` | Publication et correction. |
| 4.6 | Cahier de préparation | Partiel | Enseignant | `pedagogy.lesson-plan.*` | Spec design du 17/08. |
| 4.7 | Évaluations, notes et coefficients | Partiel | Enseignant | `server/src/pedagogy/averages.ts` | Moteur de moyennes en place. |
| 4.8 | Bulletins | À spécifier | Resp. pédagogique | — | Calculs officiels à spécifier. |
| 4.9 | Rattrapage et suivi individuel | À spécifier | Enseignant, Resp. pédagogique | — | Mentionné dans `FUNCTIONAL_CATALOG.md`. |
| 4.10 | TENAFEP / ENAFEP / EXETAT | Hors périmètre v2 | Resp. pédagogique | — | Règles à confirmer avant implémentation. |

**État global :** Partiel. Le moteur de notes/moyennes est en place ; bulletins, emplois du temps et examens nationaux restent à spécifier.

---

### 4.5 Palmarès

**Objectif :** Produire les classements et distinctions pédagogiques par classe, cycle ou période.

| # | Fonctionnalité | État | Profils | Permissions / fichiers clés | Notes |
|---|----------------|------|---------|----------------------------|-------|
| 5.1 | Calcul des rangs par matière | À spécifier | Enseignant, Resp. pédagogique | `server/src/pedagogy/averages.ts` | Réutilise les moyennes. |
| 5.2 | Classement général par classe | À spécifier | Resp. pédagogique | — | Dépend des bulletins. |
| 5.3 | Palmarès annuel / honneur | À spécifier | Chef, Resp. pédagogique | — | Format PDF à définir. |
| 5.4 | Publication aux parents | À spécifier | Resp. pédagogique | — | Vue limitée selon profil. |

**État global :** À spécifier. Les briques de calcul (moyennes) existent, mais le palmarès comme produit n’est pas encore spécifié.

---

### 4.6 Finance

**Objectif :** Gérer les frais scolaires, les encaissements, les reçus, la caisse et les rapports financiers.

| # | Fonctionnalité | État | Profils | Permissions / fichiers clés | Notes |
|---|----------------|------|---------|----------------------------|-------|
| 6.1 | Structure des frais et échéances | Implémenté | Resp. financier | `server/src/finance/control/service.ts` | `fee_structures` en base. |
| 6.2 | Frais scolaires par élève | Partiel | Agent de caisse, Resp. financier | `server/src/finance/payments/` | Soldes et impayés. |
| 6.3 | Régularité scolaire (statut sans montant) | Partiel | Resp. pédagogique, Chef | `finance.status.read` | Vue dégradée pour non-financiers. |
| 6.4 | Encaissement et recherche de paiement | Implémenté | Agent de caisse | `finance.payment.record` | `fee_payments` en base. |
| 6.5 | Annulation contrôlée de paiement | Partiel | Resp. financier | `finance.payment.cancel` | Audit et justificatif requis. |
| 6.6 | Reçus officiels PDF | Partiel | Agent de caisse | `app/modules/document-engine/` | Moteur PDF en place. |
| 6.7 | Ouverture, contrôle et clôture de caisse | Partiel | Resp. financier, Agent de caisse | `finance.cash_register.close` | Workflow de caisse. |
| 6.8 | Rapport de caisse et rapprochement | Partiel | Resp. financier, Comptable | `finance.report.read` | Export Excel/PDF. |
| 6.9 | Recettes, dépenses et pièces justificatives | À spécifier | Comptable | — | SYSCOHADA. |
| 6.10 | Comptabilité (journal, grand livre, balance) | À spécifier | Comptable | — | Plan comptable à valider. |
| 6.11 | États financiers et exports | À spécifier | Resp. financier, Comptable | — | Format et règles à spécifier. |

**État global :** Partiel. Le cœur frais/paiements/reçus existe ; la comptabilité formelle est à spécifier.

---

### 4.7 Contrôle

**Objectif :** Superviser et vérifier les règles métiers : contrôle des frais, contrôle des cartes, et supervision opérationnelle.

| # | Fonctionnalité | État | Profils | Permissions / fichiers clés | Notes |
|---|----------------|------|---------|----------------------------|-------|
| 7.1 | Campagnes de contrôle des frais | Implémenté | Resp. financier | `server/src/finance/control/service.ts` | `fee_control_campaigns`. |
| 7.2 | Scans de contrôle (élève par élève) | Implémenté | Agent de contrôle | `finance.control.scan` | `fee_control_scans`. |
| 7.3 | Affectation des contrôleurs | Implémenté | Resp. financier | `fee_control_assignees` | Lié aux campagnes. |
| 7.4 | Contrôle d’accès aux cartes (app de contrôle) | Implémenté | Admin | `server/src/control-app/client.ts` | Signature HMAC, impression cartes. |
| 7.5 | Tableau de bord de supervision | Partiel | Chef, Resp. financier | `pilotage.dashboard.read` | Réutilise Pilotage. |
| 7.6 | Alertes de non-conformité | Partiel | Chef, Resp. financier | `pilotage.alerts.*` | Liées aux campagnes et scans. |

**État global :** Partiel. Les mécanismes de campagne/scan et l’app de contrôle cartes existent ; la supervision centralisée reste à enrichir.

---

### 4.8 Sécurité & accès QR

**Objectif :** Gérer les entrées, sorties, pick-up et la sécurité physique par QR code.

| # | Fonctionnalité | État | Profils | Permissions / fichiers clés | Notes |
|---|----------------|------|---------|----------------------------|-------|
| 8.1 | Scanner un QR | Partiel | Agent de contrôle d’accès | `security.scan` | Endpoint existant. |
| 8.2 | Enregistrer une entrée / sortie | Partiel | Agent de contrôle d’accès | `server/src/security/service.ts` | `security_events`. |
| 8.3 | Préparer une sortie | À spécifier | Secrétaire, Parent | — | Demande anticipée. |
| 8.4 | Vérifier identité et personnes autorisées | Partiel | Agent de contrôle d’accès | `security.pickup.read` | Lié aux tuteurs. |
| 8.5 | Autoriser, refuser, confirmer une sortie | Partiel | Agent de contrôle d’accès | `security.pickup.manage` | Workflow pick-up. |
| 8.6 | Vue des élèves actuellement dans l’école | Partiel | Agent de contrôle d’accès | `security.events.read` | Dashboard temps réel. |
| 8.7 | Sorties en attente | Partiel | Agent de contrôle d’accès | `security.pickup.read` | Notification push possible. |
| 8.8 | Alertes, anomalies et incidents | Partiel | Agent de contrôle d’accès, Chef | `security.lockdown.manage` | Lockdown et incidents. |
| 8.9 | Historique des passages et recherche | Implémenté | Chef, Admin | `security.events.read` | `security_events` en base. |

**État global :** Partiel. L’historique et les endpoints existent ; le workflow complet de pick-up et les alertes en temps réel doivent être finalisés.

---

### 4.9 Pilotage

**Objectif :** Donner une vue transversale à la direction : indicateurs, alertes, approbations et tendances.

| # | Fonctionnalité | État | Profils | Permissions / fichiers clés | Notes |
|---|----------------|------|---------|----------------------------|-------|
| 9.1 | Dashboard de synthèse | Implémenté | Chef, Admin, Responsables | `pilotage.dashboard.read` | `server/src/pilotage/dashboard/`. |
| 9.2 | Moteur d’alertes | Implémenté | Chef, Admin | `pilotage.alerts.*` | Règles et déclencheurs. |
| 9.3 | Circuit d’approbations | Implémenté | Chef, Responsables | `pilotage.approvals.*` | `approval_requests`. |
| 9.4 | Snapshots d’indicateurs | Implémenté | Chef, Admin | `server/src/pilotage/snapshots/` | `indicator_snapshots`. |
| 9.5 | Tendances et historique | Partiel | Chef, Admin | `pilotage.dashboard.read` | Graphiques à enrichir. |
| 9.6 | Alertes avancées multi-sources | Partiel | Chef, Admin | `pilotage.alerts.manage` | Connecteur aux événements métiers. |

**État global :** Partiel. Le socle dashboard/alertes/approbations/snapshots est solide ; les tendances avancées restent à enrichir.

---

### 4.10 Communication

**Objectif :** Gérer les échanges entre l’école, le personnel et les familles.

| # | Fonctionnalité | État | Profils | Permissions / fichiers clés | Notes |
|---|----------------|------|---------|----------------------------|-------|
| 10.1 | Messagerie interne | À spécifier | Tous | — | Conversations autorisées. |
| 10.2 | Notifications in-app | Implémenté | Tous | `server/src/notifications/in-app.ts` | Table `notifications`. |
| 10.3 | Notifications email | Implémenté | Tous | `server/src/notifications/providers/brevo.ts`, `zoho.ts` | Brevo + fallback Zoho. |
| 10.4 | Notifications push Web | Partiel | Tous | `server/src/notifications/providers/push.ts` | VAPID + Web Crypto. |
| 10.5 | SMS / WhatsApp | Hors périmètre v2 | Resp. communication | — | Fournisseur et quotas à spécifier. |
| 10.6 | Annonces et événements | À spécifier | Resp. communication | — | Publication ciblée. |
| 10.7 | Convocations | À spécifier | Resp. communication, Secrétaire | — | Avec accusé de réception. |
| 10.8 | Circuits d’approbation liés à la communication | Partiel | Tous | `pilotage.approvals.*` | Réutilise Pilotage. |

**État global :** Partiel. Les notifications techniques existent ; la messagerie, les annonces et les convocations restent à spécifier.

---

### 4.11 Documents & rapports

**Objectif :** Produire, stocker et archiver les documents officiels et les exports de travail.

| # | Fonctionnalité | État | Profils | Permissions / fichiers clés | Notes |
|---|----------------|------|---------|----------------------------|-------|
| 11.1 | Documents officiels PDF (logo école) | Partiel | Tous selon permissions | `app/modules/document-engine/` | Reçus, bulletins, attestations. |
| 11.2 | Exports Excel de travail | À spécifier | Tous selon permissions | — | Listes, rapports. |
| 11.3 | Stockage R2 des documents privés | Partiel | Système | `server/src/storage/r2.ts` | Photos, PDF, backups. |
| 11.4 | Historique et audit des actions | Implémenté | Admin | `POSTGRESQL_AUDIT.md`, `public.audit_events` | Triggers d’audit. |
| 11.5 | Gestion des versions et corrections tracées | Partiel | Tous selon permissions | — | Sans écrasement silencieux. |
| 11.6 | Documents bilingues fr/en | Partiel | Tous | `BILINGUAL_CONTRACT.md` | Langue d’origine priorisée. |

**État global :** Partiel. Le moteur de documents et l’audit existent ; les exports Excel et les modèles de documents restent à enrichir.

---

### 4.12 Rapports opérationnels et indicateurs

**Objectif :** Fournir des indicateurs opérationnels et des rapports métiers exploitables par la direction.

| # | Fonctionnalité | État | Profils | Permissions / fichiers clés | Notes |
|---|----------------|------|---------|----------------------------|-------|
| 12.1 | Indicateurs quotidiens (alertes, paiements, présences) | Implémenté | Chef, Admin | `server/src/pilotage/snapshots/` | `indicator_snapshots`. |
| 12.2 | Tendances multi-jours | Partiel | Chef, Admin | `pilotage/dashboard/read` | Graphiques à enrichir. |
| 12.3 | Rapports pédagogiques | À spécifier | Resp. pédagogique | — | Résultats, absences. |
| 12.4 | Rapports financiers | Partiel | Resp. financier, Comptable | `finance.report.read` | Caisse, impayés. |
| 12.5 | Rapports de sécurité | Partiel | Agent de contrôle d’accès, Chef | `security.events.read` | Historique, anomalies. |
| 12.6 | Rapports RH | À spécifier | Resp. RH | — | Absences, paie. |

**État global :** Partiel. Les snapshots quotidiens existent ; les rapports métier formels restent à spécifier.

---

### 4.13 Cartes

**Objectif :** Conserver le sous-système historique de production des cartes et le raccorder par adaptateur.

| # | Fonctionnalité | État | Profils | Permissions / fichiers clés | Notes |
|---|----------------|------|---------|----------------------------|-------|
| 13.1 | Sous-système historique protégé | Implémenté | Système | `CARDS_IMMUTABILITY.md` | Aucune réécriture. |
| 13.2 | Demande d’impression de carte | Implémenté | Admin, Secrétaire | `cards.request.print` | `server/src/cards/`. |
| 13.3 | Adaptateur vers app de contrôle | Implémenté | Système | `server/src/control-app/client.ts` | Signature HMAC. |
| 13.4 | Patrimoine visuel des cartes | Implémenté | Système | `app/modules/cards/assets/patrimoine/` | Animaux et minéraux RDC. |

**État global :** Implémenté. Le sous-système est protégé et raccordé.

---

### 4.14 Safe assistant

**Objectif :** Guider l’utilisateur dans l’interface par une assistante conversationnelle.

| # | Fonctionnalité | État | Profils | Permissions / fichiers clés | Notes |
|---|----------------|------|---------|----------------------------|-------|
| 14.1 | Guide contextuel | Spécifié | Tous | Design global §3.6 | Mode « Montre-moi ». |
| 14.2 | FAQ interactive statique | Spécifié | Tous | `POST /safe/ask` (V1) | Réponses prédéfinies. |
| 14.3 | Feedback visuel et poses | Spécifié | Tous | Design global §3.6 | 12 poses. |
| 14.4 | RAG sur documentation (V2) | Hors périmètre v2 | Tous | — | Workers AI + Vectorize futur. |

**État global :** Spécifié. L’assistant est défini dans le design global mais pas encore implémenté.

---

### 4.15 Plateforme

**Objectif :** Fournir l’infrastructure commune : PWA, internationalisation, synchronisation hors ligne et cache.

| # | Fonctionnalité | État | Profils | Permissions / fichiers clés | Notes |
|---|----------------|------|---------|----------------------------|-------|
| 15.1 | PWA installable | Partiel | Tous | `app/index.html`, service worker | Cache de l’interface. |
| 15.2 | Internationalisation fr/en | Implémenté | Tous | `app/i18n.js` | Préférence conservée. |
| 15.3 | Cache priorisé hors ligne | Partiel | Tous | `OFFLINE_SYNC_CONTRACT.md` | File locale : sécurité, messages, devoirs, présences, pédagogie, gestion. |
| 15.4 | Synchronisation automatique et manuelle | Partiel | Tous | `sync.submit` | Wi-Fi / données mobiles. |
| 15.5 | États de synchronisation visibles | Spécifié | Tous | `OFFLINE_SYNC_CONTRACT.md` | Synchronisé, hors ligne, en attente, en cours, à vérifier. |
| 15.6 | Gestion des conflits hors ligne | À spécifier | Système | — | Contrat PWA à valider. |
| 15.7 | Reçus non provisoires hors ligne | Spécifié | Tous | `OFFLINE_SYNC_CONTRACT.md` | Pas de numéro/PDF avant confirmation serveur. |

**État global :** Partiel. L’i18n est en place ; la PWA et la sync hors ligne nécessitent des validations complémentaires.

---

## 5. Matrice synthétique profils × modules

Cette matrice indique le niveau d’accès typique de chaque profil par module. Elle ne remplace pas les permissions individuelles du catalogue.

| Profil | École | Pédagogie | Palmarès | Finance | Contrôle | Sécurité | Pilotage | Communication | Documents | Rapports | Plateforme |
|--------|-------|-----------|----------|---------|----------|----------|----------|---------------|-----------|----------|------------|
| Admin principal | Admin | Admin | Admin | Admin | Admin | Admin | Admin | Admin | Admin | Admin | Admin |
| Chef d’établissement | Lecture | Lecture | Lecture | Lecture | Lecture | Lecture | Admin | Lecture | Lecture | Admin | Lecture |
| Resp. pédagogique | Lecture | Admin | Admin | Statut | Lecture | Lecture | Lecture | Lecture | Lecture | Lecture | Lecture |
| Resp. adm. & admissions | Admin | Lecture | Lecture | — | — | — | — | — | Lecture | — | Lecture |
| Secrétaire scolaire | Saisie | Saisie | — | — | — | — | — | — | Saisie | — | Lecture |
| Resp. financier | Lecture | — | — | Admin | Admin | — | Lecture | — | Lecture | Admin | Lecture |
| Agent de caisse | — | — | — | Saisie | Scan | — | — | — | Émission reçu | — | Lecture |
| Comptable | — | — | — | Lecture | Lecture | — | — | — | Lecture | Admin | Lecture |
| Resp. RH | Admin RH | — | — | — | — | — | — | — | Lecture | Admin | Lecture |
| Enseignant | — | Classe | Classe | — | — | — | — | — | — | — | Lecture |
| Agent contrôle d’accès | — | — | — | — | — | Scan | — | — | — | — | Lecture |
| Infirmier | Passages | — | — | — | — | — | — | — | Passages | — | Lecture |
| Resp. cantine | Cantine | — | — | — | — | — | — | — | — | — | Lecture |
| Resp. communication | — | — | — | — | — | — | — | Admin | — | — | Lecture |
| Parent / responsable légal | Enfants | Enfants | Enfants | Enfants | — | — | — | Lecture | Enfants | — | Lecture |

**Légende :** Admin = configurer + consulter ; Saisie = créer/modifier dans son périmètre ; Lecture = consulter ; Statut = vue dégradée sans montant ; — = pas d’accès par défaut.

---

## 6. Permissions du catalogue (`shared/permissions.json`)

Le catalogue actuel compte **59 permissions** (44 historiques + 15 ajoutées pour les modules manquants). Elles doivent toutes être mappées à des fonctions de ce diagnostic et vérifiées côté RLS/RPC.

### Identité et école

- `session.bootstrap`
- `school.class.read`
- `school.student.read`
- `school.guardian.read`
- `school.guardian.manage`
- `school.manage`
- `staff.manage`
- `roles.manage`

### Sécurité

- `security.pickup.read`
- `security.pickup.manage`
- `security.scan`
- `security.lockdown.manage`
- `security.events.read`
- `security.card.create`

### Pilotage

- `pilotage.dashboard.read`
- `pilotage.alerts.read`
- `pilotage.alerts.manage`
- `pilotage.approvals.read`
- `pilotage.approvals.manage`

### Communication

- `email.send`
- `notification.subscribe`

### Finance

- `finance.fee.read`
- `finance.fee.manage`
- `finance.payment.record`
- `finance.payment.cancel`
- `finance.receipt.read`
- `finance.report.read`
- `finance.cash_register.close`
- `finance.control.read`
- `finance.control.manage`
- `finance.control.scan`
- `finance.status.read`

### Pédagogie

- `pedagogy.subject.read`
- `pedagogy.subject.manage`
- `pedagogy.assignment.read`
- `pedagogy.assignment.manage`
- `pedagogy.grade.read`
- `pedagogy.grade.manage`
- `pedagogy.lesson-plan.read`
- `pedagogy.lesson-plan.manage`
- `pedagogy.report.read`
- `pedagogy.report.manage`

### Palmarès

- `palmarques.read`
- `palmarques.manage`

### Personnel / RH

- `staff.read`
- `staff.attendance.read`

### Vie scolaire

- `canteen.manage`
- `infirmary.manage`

### Communication

- `email.send`
- `notification.subscribe`
- `communication.announcement.manage`
- `communication.message.send`

### Safe assistant

- `safe.assistant.use`

### Rapports

- `reports.operational.read`
- `reports.financial.read`
- `reports.security.read`
- `reports.hr.read`

### Plateforme et fichiers

- `sync.submit`
- `file.upload`
- `file.download`
- `cards.request.print`

**Vérification demandée :** chaque permission doit être testée avec un scénario RLS pour chaque profil concerné.

---

## 7. Fonctions à spécifier avant implémentation

Ces fonctions sont mentionnées dans `FUNCTIONAL_CATALOG.md` mais n’ont pas encore de spec détaillée suffisante pour être codées en sécurité.

| # | Fonction | Module | Bloqueur |
|---|----------|--------|----------|
| 1 | Calculs officiels des moyennes, coefficients, bulletins et palmarès par cycle | Pédagogie / Palmarès | Règles du pays et du cycle à valider. |
| 2 | TENAFEP / ENAFEP et EXETAT | Pédagogie | Règles des examens nationaux à confirmer. |
| 3 | Règles SYSCOHADA, corrections et annulations comptables | Finance / Comptabilité | Plan comptable et fiscalité à valider. |
| 4 | Paie, avances, primes, retenues et fiscalité applicable | Personnel / RH | Règles de paie locales à valider. |
| 5 | Synchronisation biométrique | Personnel / RH | Protocole appareils à spécifier. |
| 6 | Notifications SMS, WhatsApp et quotas fournisseurs | Communication | Fournisseur et budget à valider. |
| 7 | Implémentation serveur des conflits et reprise hors ligne | Plateforme | Contrat PWA à valider. |
| 8 | Facturation et stock éventuel de la cantine | Vie scolaire | Règles de facturation cantine à préciser. |
| 9 | Import massif d’élèves avec détection de doublons | École | Format et stratégie de fusion à définir. |
| 10 | Emplois du temps | Pédagogie | Modèle de données et contraintes à définir. |

---

## 8. Points de vigilance et blocages pour le lancement

### 8.1 Sécurité

- Aucune fonction frontend ne constitue une protection. Chaque permission du catalogue doit avoir son équivalent RLS/RPC.
- Les secrets (JWT, R2, Brevo, VAPID, HMAC cartes) doivent rester dans Wrangler Secrets / Secrets Store.
- Le `service_role_key` ne doit jamais être exposé au frontend.

### 8.2 Données

- Le portage Fastify → Workers est en cours. Les deux backends ne doivent pas coexister en production sans stratégie de bascule.
- Les migrations Supabase doivent être appliquées avec backup préalable.
- Les documents R2 doivent rester séparés du site public.

### 8.3 Expérience utilisateur

- L’offline sync est critique pour la sécurité et la pédagogie. Le contrat doit être validé avant tout déploiement sur le terrain.
- Les reçus hors ligne ne doivent jamais être provisoires avec un numéro local.

### 8.4 Tests

- Objectif de couverture : 80 % (unitaires, intégration, RLS, E2E).
- Chaque fonction classée `implémenté` doit avoir au minimum un test RLS + un test d’endpoint.
- Les fonctions classées `partiel` ne peuvent pas être considérées comme livrées sans les tests manquants.

---

## 9. Règle d’autorisation permanente et audit de conformité

### 9.1 La règle

Toute autorisation dans SchoolSafe V2 doit suivre la chaîne :

`USER → SCHOOL → ROLE → PERMISSION → SCOPE → CONDITION → EXCEPTION → AUDIT`

| Maillon | Définition | Implémentation actuelle |
|---------|------------|------------------------|
| **USER** | Profil authentifié dans `public.profiles`. | `current_profile_id()` via `auth.uid()`. |
| **SCHOOL** | Isolation par école ; une instance = une école. | `profiles.school_id` + RLS sur toutes les tables métier. |
| **ROLE** | Modèle métier attribué au profil. | `roles`, `profile_roles`. |
| **PERMISSION** | Action autorisée dans le catalogue. | `permissions`, `role_permission_grants` avec `allowed = true`. |
| **SCOPE** | Périmètre de données (classe, cycle, enfant, portail…). | **OK.** Scopes normalisés (`own`, `own_children`, `assigned_classes`, `assigned_subjects`, `assigned_portal`, `school`, `none`) dans `shared/permissions.json` et `docs/ACCESS_MODEL.md` ; validation au chargement du catalogue. |
| **CONDITION** | Circonstances requises pour l’action (année active, caisse ouverte, campagne publiée…). | **Partiel.** Système créé (`has_condition`, `permission_conditions`, `condition_type`). Conditions critiques raccordées : caisse ouverte, délai d’annulation, campagne publiée. Restent à étendre : scan portail (lien location/portail à finaliser), publication des notes, quota email. |
| **EXCEPTION** | Ajustement individuel ALLOW/DENY pour un profil précis, hors rôle. | **OK.** Table `profile_permission_exceptions` créée ; `has_permission` réécrit avec résolution DENY rôle → DENY exception → ALLOW exception → rôles ; audit des exceptions ajouté. Validation en base réelle à faire. |
| **AUDIT** | Traçabilité des opérations sensibles et des changements de droits. | **Partiel.** Table enrichie (`success`, `target_profile_id`) ; triggers sur rôles, permissions, scopes, paiements, clôtures de caisse, scans de sécurité, approbations, notes et impressions de cartes (C4). Validation en base réelle à faire. |

Principes non négociables :

- Tout ce qui n’est pas explicitement autorisé = **DENY**.
- Une interdiction explicite l’emporte toujours sur une autorisation.
- Le frontend ne constitue pas une sécurité : chaque vérification doit exister côté backend/API **et** dans Supabase RLS.

### 9.2 État de conformité global

| Maillon | État | Écart détecté |
|---------|------|---------------|
| USER | OK | Aucun. |
| SCHOOL | OK | Vérification explicite dans `has_permission`/`has_scope` absente, mais couverte par RLS (`*_current_school`) et `current_profile_id`. |
| ROLE | OK | Aucun. |
| PERMISSION | OK | 59 permissions dans `shared/permissions.json` (44 historiques + 15 manquantes). |
| SCOPE | OK | Mécanisme générique présent ; scopes normalisés dans `shared/permissions.json` et `docs/ACCESS_MODEL.md` ; validation au chargement. |
| CONDITION | Partiel | Système créé et conditions critiques raccordées. Extensions (scan portail, publication notes, quota) à finaliser. |
| EXCEPTION | OK | Table et résolution créées, audit ajouté. Validation en base réelle à faire. |
| AUDIT | Partiel | Table enrichie (`success`, `target_profile_id`) ; triggers sur opérations métier créés (C4). Validation en base réelle à faire. |

### 9.3 Audit des 59 permissions du catalogue

#### Légende

- **Scope applicable** : `school`, `assigned_classes`, `assigned_subjects`, `own_children`, `own`, `assigned_portal`, `none`.
- **Condition** : circonstance requise pour l’action.
- **Exception** : nécessite-t-elle un ajustement individuel hors rôle ?
- **Audit** : doit-être loggué dans `public.audit_events` ?
- **Statut** :
  - `OK` : permission, scope et audit alignés.
  - `Partiel` : mécanisme présent, mapping ou condition à préciser.
  - `Écart` : condition ou exception manquante.

#### 9.3.1 Identité et école

| Permission | Scope applicable | Condition | Exception | Audit | Statut |
|------------|------------------|-----------|-----------|-------|--------|
| `session.bootstrap` | `none` (setup) | Token de setup valide | Non | Oui | Écart (condition non codée) |
| `school.class.read` | `school` / `assigned_classes` | Année scolaire active | Non | Non | Partiel (scope à mapper) |
| `school.student.read` | `school` / `assigned_classes` / `own_children` | Année scolaire active | Non | Non | Partiel |
| `school.guardian.read` | `school` / `own_children` | — | Non | Non | Partiel |
| `school.guardian.manage` | `school` | — | Oui | Oui | Écart (exception individuelle manquante) |
| `school.manage` | `school` | — | Oui | Oui | Écart (exception individuelle manquante) |
| `staff.manage` | `school` | — | Oui | Oui | Écart (exception individuelle manquante) |
| `roles.manage` | `school` | — | Oui | Oui | Écart (exception individuelle manquante) |

#### 9.3.2 Sécurité

| Permission | Scope applicable | Condition | Exception | Audit | Statut |
|------------|------------------|-----------|-----------|-------|--------|
| `security.pickup.read` | `school` / `assigned_classes` / `own_children` | — | Non | Non | Partiel |
| `security.pickup.manage` | `school` / `assigned_portal` | Portail actif | Non | Oui | Écart (condition non codée) |
| `security.scan` | `assigned_portal` | Caisse/Point ouvert | Non | Oui | Écart (condition non codée) |
| `security.lockdown.manage` | `school` | — | Oui | Oui | Écart (condition + exception) |
| `security.events.read` | `school` / `assigned_classes` / `own_children` | — | Non | Non | Partiel |
| `security.card.create` | `school` | — | Oui | Oui | Écart (exception individuelle manquante) |

#### 9.3.3 Pilotage

| Permission | Scope applicable | Condition | Exception | Audit | Statut |
|------------|------------------|-----------|-----------|-------|--------|
| `pilotage.dashboard.read` | `school` | — | Non | Non | OK |
| `pilotage.alerts.read` | `school` / `assigned_classes` | — | Non | Non | Partiel |
| `pilotage.alerts.manage` | `school` | — | Oui | Oui | Écart (exception) |
| `pilotage.approvals.read` | `school` / `own` / `assigned_classes` | — | Non | Non | Partiel |
| `pilotage.approvals.manage` | `school` / `own` | Statut `pending` | Non | Oui | Écart (condition non codée) |

#### 9.3.4 Communication

| Permission | Scope applicable | Condition | Exception | Audit | Statut |
|------------|------------------|-----------|-----------|-------|--------|
| `email.send` | `school` | Quota disponible | Non | Oui | Écart (condition quota non codée) |
| `notification.subscribe` | `own` | — | Non | Non | OK |

#### 9.3.5 Finance

| Permission | Scope applicable | Condition | Exception | Audit | Statut |
|------------|------------------|-----------|-----------|-------|--------|
| `finance.fee.read` | `school` / `assigned_classes` / `own_children` | — | Non | Non | Partiel |
| `finance.fee.manage` | `school` | Année active | Oui | Oui | Écart (condition + exception) |
| `finance.payment.record` | `school` / `assigned_classes` | Caisse ouverte | Non | Oui | Écart (condition caisse non codée) |
| `finance.payment.cancel` | `school` | Dans délai d’annulation | Oui | Oui | Écart (condition non codée) |
| `finance.receipt.read` | `school` / `own_children` | — | Non | Non | Partiel |
| `finance.report.read` | `school` | — | Non | Non | OK |
| `finance.cash_register.close` | `school` | Solde caisse = attendu | Non | Oui | Écart (condition non codée) |
| `finance.control.read` | `school` | — | Non | Non | OK |
| `finance.control.manage` | `school` | — | Oui | Oui | Écart (exception) |
| `finance.control.scan` | `school` / `assigned_classes` | Campagne publiée | Non | Oui | Écart (condition non codée) |
| `finance.status.read` | `school` / `assigned_classes` / `own_children` | — | Non | Non | Partiel |

#### 9.3.6 Pédagogie

| Permission | Scope applicable | Condition | Exception | Audit | Statut |
|------------|------------------|-----------|-----------|-------|--------|
| `pedagogy.subject.read` | `school` / `assigned_subjects` | — | Non | Non | Partiel |
| `pedagogy.subject.manage` | `school` | Année active | Oui | Oui | Écart (condition + exception) |
| `pedagogy.assignment.read` | `school` / `assigned_classes` / `assigned_subjects` / `own_children` | — | Non | Non | Partiel |
| `pedagogy.assignment.manage` | `school` / `assigned_classes` / `assigned_subjects` | Période active | Oui | Oui | Écart (condition non codée) |
| `pedagogy.grade.read` | `school` / `assigned_classes` / `assigned_subjects` / `own_children` | Statut publié | Non | Non | Écart (condition publication non codée) |
| `pedagogy.grade.manage` | `school` / `assigned_classes` / `assigned_subjects` | Période active + statut brouillon | Oui | Oui | Écart (condition non codée) |
| `pedagogy.lesson-plan.read` | `school` / `assigned_classes` / `assigned_subjects` | — | Non | Non | Partiel |
| `pedagogy.lesson-plan.manage` | `school` / `assigned_classes` / `assigned_subjects` | — | Oui | Oui | Écart (exception) |

#### 9.3.7 Plateforme et fichiers

| Permission | Scope applicable | Condition | Exception | Audit | Statut |
|------------|------------------|-----------|-----------|-------|--------|
| `sync.submit` | `own` / `school` | — | Non | Oui | Partiel (audit à ajouter) |
| `file.upload` | `school` / `own` | Type et taille valides | Non | Oui | Écart (condition non codée) |
| `file.download` | `school` / `own` / `own_children` | Permission R2 valide | Non | Non | Partiel |
| `cards.request.print` | `school` | Format valide | Oui | Oui | Écart (exception) |

### 9.4 Synthèse de l’audit des permissions

| Domaine | Permissions | OK | Partiel | Écart |
|---------|-------------|----|---------|-------|
| Identité / École | 8 | 0 | 3 | 5 |
| Sécurité | 6 | 0 | 3 | 3 |
| Pilotage | 5 | 1 | 2 | 2 |
| Communication | 4 | 1 | 0 | 3 |
| Finance | 11 | 2 | 3 | 6 |
| Pédagogie | 10 | 0 | 3 | 7 |
| Palmarès | 2 | 0 | 0 | 2 |
| Personnel / RH | 2 | 0 | 0 | 2 |
| Vie scolaire | 2 | 0 | 0 | 2 |
| Safe assistant | 1 | 0 | 0 | 1 |
| Rapports | 4 | 0 | 0 | 4 |
| Plateforme / Fichiers | 4 | 0 | 3 | 1 |
| **Total** | **59** | **4** | **17** | **38** |

> **Note post-C1/C2/C4 :** les mécanismes de conditions, d’exceptions individuelles et d’audit sont créés. Les permissions historiques marquées « Écart (condition) », « Écart (exception) » ou « Écart (audit) » passent en « Partiel » dès que le mécanisme générique les couvre. Les nouvelles permissions ajoutées en C5 sont en « Écart » en attendant leur mapping RLS/tests.

### 9.5 Audit des 15 profils contre la règle

Pour chaque profil, on vérifie qu’il dispose d’un rôle de base, qu’un périmètre par défaut est défini, et que les exceptions individuelles peuvent être appliquées par l’administrateur principal.

| # | Profil | Rôle de base | Scope par défaut | Exceptions individuelles possibles | Audit des attributions | Statut |
|---|--------|--------------|------------------|------------------------------------|------------------------|--------|
| 1 | Administrateur principal | `admin` | `school` | Oui | Oui | OK (mécanisme créé, validation RLS à venir) |
| 2 | Chef d’établissement | `principal` | `school` | Oui | Oui | OK (mécanisme créé, validation RLS à venir) |
| 3 | Responsable pédagogique | `pedagogy_manager` | `school` / cycles | Oui | Oui | OK (mécanisme créé, validation RLS à venir) |
| 4 | Responsable administratif et admissions | `admissions_manager` | `school` | Oui | Oui | OK (mécanisme créé, validation RLS à venir) |
| 5 | Secrétaire scolaire | `secretary` | `school` / classes assignées | Oui | Oui | OK (mécanisme créé, validation RLS à venir) |
| 6 | Responsable financier | `finance_manager` | `school` | Oui | Oui | OK (mécanisme créé, validation RLS à venir) |
| 7 | Agent de caisse | `cashier` | `school` / points de caisse | Oui | Oui | OK (mécanisme créé, validation RLS à venir) |
| 8 | Comptable | `accountant` | `school` | Oui | Oui | OK (mécanisme créé, validation RLS à venir) |
| 9 | Responsable RH | `hr_manager` | `school` | Oui | Oui | OK (mécanisme créé, validation RLS à venir) |
| 10 | Enseignant | `teacher` | `assigned_classes` / `assigned_subjects` | Oui | Oui | OK (mécanisme créé, validation RLS à venir) |
| 11 | Agent de contrôle d’accès | `security_guard` | `assigned_portal` | Oui | Oui | OK (mécanisme créé, validation RLS à venir) |
| 12 | Infirmier | `nurse` | `school` | Oui | Oui | OK (mécanisme créé, validation RLS à venir) |
| 13 | Responsable cantine | `canteen_manager` | `school` | Oui | Oui | OK (mécanisme créé, validation RLS à venir) |
| 14 | Responsable communication et site | `communication_manager` | `school` | Oui | Oui | OK (mécanisme créé, validation RLS à venir) |
| 15 | Parent ou responsable légal | `parent` | `own_children` | Oui | Oui | OK (mécanisme créé, validation RLS à venir) |

**Constat :** tous les profils ont un rôle et un scope par défaut cohérents. Le mécanisme d’**exception individuelle** au niveau du profil est créé (`profile_permission_exceptions`) et intégré dans `has_permission()`. La validation en base réelle est à finaliser (C2).

### 9.6 Écarts par module

| Module | Écart principal | Impact |
|--------|-----------------|--------|
| Auth & setup | `session.bootstrap` dépend d’une condition (token setup) non formalisée. | Risque d’installation non contrôlée. |
| École | `school.guardian.manage`, `school.manage`, `staff.manage`, `roles.manage` nécessitent des exceptions individuelles. | Un admin ne peut pas encore retirer une permission à un seul utilisateur. |
| Personnel / RH | Permissions ajoutées (`staff.read`, `staff.attendance.read`) ; mapping RLS/tests à faire. | Le module RH n’a pas de permissions propres. |
| Pédagogie | Conditions de publication des notes et période active non codées. | Risque de modification de notes après publication. |
| Palmarès | Permissions ajoutées (`palmarques.read`, `palmarques.manage`) ; mapping RLS/tests à faire. | Le palmarès n’est pas protégé par le catalogue. |
| Finance | Conditions caisse ouverte, délai d’annulation, campagne publiée codées. | Risque financier et opérationnel réduit. |
| Contrôle | `finance.control.scan` dépend de la condition « campagne publiée ». | Scan possible hors campagne valide. |
| Sécurité | `security.scan` et `security.pickup.manage` dépendent du portail actif. | Scan hors point de contrôle autorisé. |
| Pilotage | `pilotage.approvals.manage` dépend du statut `pending`. | Approbation d’une demande déjà traitée. |
| Communication | `email.send` dépend du quota disponible. | Dépassement de quota possible. |
| Documents & rapports | `file.upload` dépend du type/taille ; `file.download` du périmètre R2. | Téléchargement de fichiers hors périmètre. |
| Rapports opérationnels | Permissions ajoutées (`reports.operational/financial/security/hr.read`) ; mapping RLS/tests à faire. | Granularité insuffisante. |
| Cartes | `cards.request.print` : mécanisme d’exception créé ; mapping RLS/tests à finaliser. | Impression non contrôlée par utilisateur. |
| Safe assistant | Permission ajoutée (`safe.assistant.use`) ; mapping RLS/tests à faire. | L’assistant est accessible à tous sans contrôle. |
| Plateforme | `sync.submit` et conflits hors ligne non audités systématiquement. | Perte de traçabilité des modifications offline. |

### 9.7 Corrections proposées

#### C1 — Créer un système de conditions

> **État : implémenté** dans `supabase/migrations/20260820000001_permission_conditions.sql` et `supabase/migrations/20260820000002_cancel_payment_condition.sql`. Tests unitaires dans `tests/qa/unit/conditions.test.ts`.

Ajouter une table `permission_conditions` ou des attributs conditionnels dans `role_permission_grants` et `scope_assignments` :

```text
condition_type : academic_year_active | cash_register_open | campaign_published | within_cancellation_window | quota_available | device_managed | status_pending
condition_params : jsonb
```

Créer une RPC `has_condition(condition_type, params)` appelée après `has_permission` et `has_scope`.

Permissions concernées en priorité : `finance.payment.record`, `finance.payment.cancel`, `finance.control.scan`, `security.scan`, `security.pickup.manage`, `pilotage.approvals.manage`, `pedagogy.grade.manage`, `email.send`.

#### C2 — Ajouter les exceptions individuelles au niveau profil

> **État : implémenté** dans `supabase/migrations/20260820000003_profile_permission_exceptions.sql`. Tests unitaires dans `tests/qa/unit/exceptions.test.ts`.

Créer une table `profile_permission_exceptions` :

```text
profile_id uuid
permission_code text
allowed boolean
reason text
granted_by uuid
granted_at timestamptz
expires_at timestamptz nullable
```

Modifier `has_permission` pour prendre en compte :

1. Autorisations de rôles (`allowed = true`).
2. Refus de rôles (`allowed = false`).
3. Exception individuelle ALLOW ou DENY.

Règle de résolution : **DENY explicite (rôle ou exception) l’emporte toujours.**

Permissions concernées : toutes les permissions d’administration (`roles.manage`, `school.manage`, `staff.manage`, `finance.control.manage`, `security.lockdown.manage`, `school.guardian.manage`, `cards.request.print`).

#### C3 — Normaliser les types de scope

> **État : implémenté** dans `shared/permissions.json`, `server/src/access/permission-catalog.ts`, `docs/ACCESS_MODEL.md` et `tests/qa/unit/scopes.test.ts`.

Définir dans la documentation et dans le code les types de scope officiels :

- `own` : données du profil connecté.
- `own_children` : données des enfants rattachés.
- `assigned_classes` : classes affectées.
- `assigned_subjects` : matières affectées.
- `assigned_portal` : portail / point de contrôle affecté.
- `school` : toute l’école.

Ajouter une validation côté application qui empêche l’utilisation de types non reconnus.

#### C4 — Auditer systématiquement les opérations sensibles et les refus

> **État : implémenté** dans `supabase/migrations/20260820000004_systematic_audit.sql`, `server/src/audit/service.ts` et `tests/qa/integration/audit.flows.test.ts`.

Pour chaque opération ci-dessous, garantir un `INSERT` dans `public.audit_events` avec `actor_profile_id`, `event_type`, `payload`, `request_id` et `success` (booléen) :

**Opérations réussies à tracer :**

- Création / modification / suppression d’un rôle ou d’une permission.
- Ajout ou retrait d’une exception individuelle.
- Modification d’un périmètre (`scope_assignments`).
- Encaissement, annulation de paiement, clôture de caisse.
- Scan QR, autorisation/refus de sortie, lockdown.
- Publication de notes, bulletins, palmarès.
- Approbation / rejet d’une demande.
- Demande d’impression de carte.
- Upload/download de documents sensibles.
- Connexions et échecs de connexion répétés.

**Tentatives refusées à tracer lorsqu’elles présentent un intérêt de sécurité :**

- Accès refusé à une ressource sensible (permission, scope, condition ou exception non satisfaite).
- Tentative d’annulation de paiement hors délai ou sans autorisation.
- Tentative de scan QR hors portail assigné ou avec un QR invalide.
- Tentative de publication/modification de notes après la période autorisée.
- Tentative de clôture de caisse avec un solde non concilié.
- Tentative de modification d’un rôle, d’une permission ou d’une exception sans droit.

Chaque événement d’échec doit inclure la raison du refus (`permission_denied`, `scope_denied`, `condition_denied`, `exception_denied`) pour faciliter les investigations.

#### C5 — Ajouter les permissions manquantes (une permission = un droit précis)

> **État : implémenté** dans `shared/permissions.json` et `tests/qa/unit/permission-catalog.test.ts`. Le catalogue compte désormais 59 permissions.

Ajouter au catalogue `shared/permissions.json` les permissions suivantes pour couvrir les modules non protégés. Chaque permission doit représenter un seul droit métier ; aucune permission combinée ou ambiguë n’est acceptée :

- `pedagogy.report.read`
- `pedagogy.report.manage`
- `palmarques.read`
- `palmarques.manage`
- `staff.read`
- `staff.attendance.read`
- `canteen.manage`
- `infirmary.manage`
- `communication.announcement.manage`
- `communication.message.send`
- `safe.assistant.use`
- `reports.operational.read`
- `reports.financial.read`
- `reports.security.read`
- `reports.hr.read`

#### C6 — Vérifier chaque RLS avec la chaîne complète

> **État : implémenté** dans `supabase/migrations/20260820000006_rls_chain_review.sql` et `tests/qa/rls/rls.test.ts`. Les tables prioritaires ont des politiques restrictives supplémentaires ; les politiques permissives existantes sont conservées pour l’isolement par école.

Pour chaque table métier, la politique RLS doit vérifier explicitement la chaîne complète :

`USER → SCHOOL → ROLE → PERMISSION → SCOPE → CONDITION → EXCEPTION`

Ordre de vérification conseillé dans la politique RLS ou le middleware API :

1. **USER** : authentification valide (`auth.uid()` présent et actif dans `public.profiles`).
2. **SCHOOL** : `school_id` de la ligne = `school_id` du profil connecté (`current_profile_id()`).
3. **ROLE** : le profil possède au moins un rôle.
4. **PERMISSION** : `has_permission(<permission_requise>)` retourne `true`.
5. **SCOPE** : `has_scope(<scope_type>, <scope_id>)` retourne `true` lorsque c’est pertinent.
6. **CONDITION** : `has_condition(<condition_type>, <params>)` retourne `true` lorsque c’est pertinent.
7. **EXCEPTION** : aucune exception individuelle DENY ne s’applique au profil pour cette permission.

Règle de priorité : **un DENY explicite au niveau rôle ou au niveau exception individuelle l’emporte toujours sur un ALLOW.** La fonction `has_permission()` doit retourner `false` dès qu’un refus explicite est détecté, indépendamment des autorisations parallèles.

### 9.8 Résumé des écarts prioritaires

| Priorité | Écart | Correction |
|----------|-------|------------|
| **P0** | Conditions non codées (caisse, annulation, scan, publication notes, approbations) | C1 — Système de conditions |
| **P0** | Exceptions individuelles manquantes | C2 — Table `profile_permission_exceptions` |
| **P1** | Audit non systématique | C4 — Déclencheurs `audit_events` |
| **P1** | Types de scope non normalisés | C3 — Liste officielle et validation |
| **P2** | Permissions manquantes pour Palmarès, RH, Cantine, Infirmerie, Communication, Safe, Rapports | C5 — Extension du catalogue |
| **P2** | RLS non vérifiées contre la chaîne complète | C6 — Revue RLS par table (implémenté, validation en base réelle à faire) |

---

## 10. Prochaines étapes recommandées

1. ~~**Validation** des écarts et corrections proposés dans la section 9.~~ ✅ Validé le 2026-08-19.
2. **Plan d’action QA** : scénarios de test par profil et par module (choix 3).
3. **Spécifications prioritaires** : bulletins, palmarès, comptabilité, paie, offline sync.
4. **Implémentation** des corrections d’autorisation (C1 à C6) dans l’ordre de priorité.
5. **Roadmap de lancement** : définir le périmètre minimum livrable (MVP) vs. les fonctions reportées.

---

*Ce document est une base de vérité vivante. Toute fonction qui change d’état ou toute évolution du modèle d’autorisation doit mettre à jour ce diagnostic.*
