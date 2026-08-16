# SchoolSafe V2 — Mémoire de travail officielle

> Fichier de continuité du projet.  
> Mis à jour après chaque étape importante, décision ou nouvelle idée.  
> Ce document est la source de vérité pour reprendre le travail dans une nouvelle session.

---

## 1. Objectif actuel du projet

### Ce que nous construisons

SchoolSafe V2 est une application de gestion scolaire complète, déployée **une école par instance** :
- une école = un VPS isolé + une base Supabase isolée + un domaine propre ;
- l'application reste identique pour toutes les écoles, seuls `apiBase`, `supabase_url` et `supabase_anon_key` changent ;
- le propriétaire conserve un contrôle central via une future application de contrôle des tokens d'instance.

### Vision générale

- Première connexion contrôlée par un token de setup généré par le déployeur.
- L'école configure elle-même son identité, ses cycles, son année scolaire, ses coordonnées, son identité visuelle et son administrateur principal.
- Connexion par e-mail ou par téléphone, sans coût SMS : le téléphone est résolu en e-mail côté VPS.
- PWA installable avec cache et reprise hors connexion.
- Modules métiers : élèves, pédagogie, finances, sécurité/accès, personnel, communication, documents.
- Sous-système historique de production de cartes protégé et branché par contrat.

### Priorités actuelles

1. Terminer et valider l'Étape 2 — Configuration mono-école (**FAIT**).
2. Étudier et intégrer la production de cartes élèves (**EN COURS**).
3. Construire l'application de contrôle centrale des tokens d'instance.
4. Rédiger la fiche de lancement de l'application.

---

## 2. Décisions validées

### Architecture

- **1 école = 1 VPS + 1 base Supabase isolée**.
- Le front PWA est identique pour toutes les écoles ; seuls l'`apiBase` et les clés Supabase changent.
- Séparation claire : Front PWA · API VPS · Supabase · Brevo · R2.
- Chaque école a son propre nom de domaine ; migration depuis/vers SchoolSafe possible plus tard.

### Authentification

- E-mail + mot de passe via Supabase Auth.
- Téléphone + mot de passe : le front envoie le téléphone au VPS, le VPS renvoie l'e-mail associé, le front se connecte avec e-mail + mot de passe.
- Pas de SMS payant ; pas d'OTP SMS pour l'instant.
- Premier administrateur créé pendant la configuration de l'école avec mot de passe défini directement.

### E-mails

- Brevo est le fournisseur principal pour les e-mails transactionnels.
- Quand Brevo atteint sa limite, le VPS prend le relais (SMTP du VPS ou envoi manuel/WhatsApp en secours).

### Stockage des fichiers lourds

- **R2** stocke les fichiers lourds : photos des élèves, devoirs, pièces jointes, archives, documents officiels.
- **VPS** stocke : logo officiel de l'école, modèles de documents PDF, fichiers générés temporairement.
- La base de données stocke les métadonnées (nom, clé R2, propriétaire, niveau de confidentialité).

### Configuration de l'école (Étape 2)

- L'école remplit elle-même les 7 étapes de configuration.
- Les données sont écrites dans Supabase à la fin.
- Le logo reste sur le VPS.
- Le nom de l'école existe en français et en anglais.

### Cartes élèves

- Le système de production de cartes existant est **protégé**.
- SchoolSafe V2 ne le remplace pas et ne le réimplémente pas.
- On le connectera par un **adaptateur versionné** après validation de tests de contrat.
- Le QR code actuel contient : `schoolsafe://student/{matricule}`.

### Sécurité

- RLS sur toutes les tables sensibles.
- Aucun multi-tenant complexe : une base = une école.
- L'interface ne constitue pas une barrière de sécurité ; l'autorité définitive est côté serveur et base.

---

## 3. Idées et demandes

### Idées déjà réalisées

- Token de setup pour contrôler l'ouverture de la configuration.
- Connexion téléphone résolue en e-mail côté VPS.
- Schéma Supabase pour l'Étape 2.
- API VPS avec endpoints de setup et d'authentification.

### Idées en attente de développement

- **Application de contrôle centrale** : générer/révoquer les tokens d'école, bloquer/débloquer une instance, réinitialisation d'urgence admin.
- **Fiche de lancement** : document expliquant comment démarrer l'application.
- **Double rôle** : un utilisateur peut avoir plusieurs rôles (ex. enseignant + parent), avec union des permissions et des périmètres.
- **Production de cartes** : intégrer le système existant via adaptateur.
- **Envoi de messages/WhatsApp** : secours manuel pour les codes et alertes.

### Idées à creuser

- Utiliser le GSM/SMS local sur le VPS pour un envoi de SMS gratuit plus tard.
- Historique des années scolaires et variation du logo/couleurs par année.

---

## 4. Travail terminé

### Étape 2 — Configuration mono-école

- Schéma Supabase étendu (`schools`, `academic_years`, `school_cycles`, `school_contacts`, `profiles`).
- RLS pour les nouvelles tables.
- API VPS avec endpoints :
  - `GET /config`
  - `POST /setup/validate-token`
  - `POST /setup/school`
  - `POST /setup/admin`
  - `POST /auth/lookup-phone`
- Front connecté : token de setup, validation, envoi des 7 étapes à l'API.
- Connexion e-mail/téléphone fonctionnelle.
- Tests unitaires serveur (26/26 passent).
- Test permanent preview (3/3 passent).
- `STATUS_V2.md` mis à jour.

### Fichiers importants créés ou modifiés

- `supabase/migrations/202608160001_step2_school_configuration.sql`
- `server/src/setup/schema.ts`
- `server/src/setup/service.ts`
- `server/src/setup/routes.ts`
- `server/src/config/env.ts`
- `server/src/app.ts`
- `server/src/index.ts`
- `server/src/http/errors.ts`
- `server/tests/setup.test.ts`
- `app/app.js`
- `app/index.html`
- `coordination/STATUS_V2.md`

### Merges et pushes

- Tout a été poussé sur `origin/main`.
- Commits récents :
  - `feat(db): add Step 2 mono-école configuration schema`
  - `feat(server): add VPS API foundation and Step 2 setup endpoints`
  - `feat(app): connect Step 2 setup and auth to VPS API`
  - `feat(app): finalize email and phone login via VPS lookup`
  - `docs: mark Step 2 mono-école configuration as complete`

---

## 5. Travail en cours

### Tâche exacte

**Analyse du système de production de cartes élèves existant** à l'URL [https://medt121.github.io/zalavrai/](https://medt121.github.io/zalavrai/).

### État d'avancement

- Le système a été récupéré et analysé à haut niveau.
- Technologies identifiées : html2canvas, qrcodejs, jszip, html2pdf.js.
- Deux formats identifiés : badge vertical et carte PVC horizontale.
- QR code : `schoolsafe://student/{matricule}`.
- Processus de production identifié : aperçu → capture → upload → impression/téléchargement.

### Fichiers concernés

- Analyse temporaire stockée dans `/tmp/zalavrai.html` (hors projet).
- `docs/CARDS_IMMUTABILITY.md` (règles de protection).

### Problèmes rencontrés

- Aucun problème bloquant. Attente de la décision du propriétaire sur la méthode d'intégration.

---

## 6. Travail restant

### Fonctionnalités non terminées

- Intégration concrète de la production de cartes dans SchoolSafe V2.
- Application de contrôle centrale.
- Fiche de lancement.
- Gestion du double rôle (enseignant + parent).

### Améliorations prévues

- Tests de contrat pour l'adaptateur cartes.
- Documentation de l'interface du système de cartes.
- Gestion des duplicatas et de l'historique d'impression.

### Prochaines étapes logiques

1. Confirmer avec le propriétaire la méthode d'intégration des cartes.
2. Documenter l'interface d'entrée/sortie du système de cartes.
3. Créer l'adaptateur versionné.
4. Écrire les tests de contrat.
5. Passer à l'application de contrôle centrale.

---

## 7. Architecture actuelle

### Frontend

- PWA dans `app/` :
  - `index.html` : structure des écrans
  - `app.js` : logique principale (splash, auth, setup, workspace, modules)
  - `styles.css` : styles
  - `i18n.js` : internationalisation
  - `offline-sync.js` : synchronisation hors connexion
- Serveur local `app/server.mjs` sur `127.0.0.1:4175`.

### Backend

- Fastify dans `server/src/` :
  - `auth/` : vérification Supabase
  - `bootstrap/` : chargement du contexte utilisateur
  - `setup/` : création de l'école et de l'administrateur
  - `health/` : points de contrôle
  - `http/` : gestion des erreurs
- Exécuté sur le VPS de l'école.

### Supabase / PostgreSQL

- Tables existantes : `school`, `school_settings`, `profiles`, `devices`, `roles`, `permissions`, `profile_roles`, `role_permission_grants`, `scope_assignments`, `audit_events`.
- Tables ajoutées pour l'Étape 2 : `academic_years`, `school_cycles`, `school_contacts`.
- Colonnes ajoutées à `school` et `profiles`.

### Authentification

- Supabase Auth avec e-mail + mot de passe.
- Téléphone résolu en e-mail via endpoint `/auth/lookup-phone` sur le VPS.

### Stockage

- R2 pour les fichiers lourds.
- VPS pour le logo et les documents temporaires.

### API

- `GET /config` : configuration Supabase pour le front.
- `POST /session/bootstrap` : contexte de session.
- `POST /setup/validate-token` : validation du token de setup.
- `POST /setup/school` : création de l'école.
- `POST /setup/admin` : création de l'administrateur.
- `POST /auth/lookup-phone` : recherche d'e-mail par téléphone.

### RLS et permissions

- RLS activé sur toutes les tables sensibles.
- Fonctions utilitaires : `current_profile_id()`, `current_school_id()`, `has_permission()`, `has_scope()`.
- Périmètres : cycle, classe, matière, service, portail, enfants rattachés.

### Services externes

- **Brevo** : e-mails transactionnels.
- **Supabase** : base de données et authentification.
- **R2** : stockage de fichiers.

---

## 8. Contraintes de sécurité

- Ne jamais toucher au VPS de production.
- Ne jamais toucher au Docker de production.
- Ne jamais modifier directement Supabase/PostgreSQL de production.
- Ne jamais supprimer ou écraser des données existantes.
- Ne jamais exposer de secrets (clés, tokens, mots de passe).
- Ne jamais déployer en production sans autorisation explicite.
- Le sous-système de production de cartes reste protégé et ne doit pas être réimplémenté.

---

## 9. Dernier point de reprise

### Où je me suis arrêté

Analyse du système de production de cartes existant à [https://medt121.github.io/zalavrai/](https://medt121.github.io/zalavrai/).  
L'analyse à haut niveau est terminée ; la décision d'intégration n'est pas encore prise.

### Ce que j'étais en train de faire

Poser des questions au propriétaire pour choisir la méthode d'intégration :
- le système zalavrai est-il l'application définitive ?
- le code source est-il disponible localement ?
- faut-il continuer à produire les cartes dans ce système ou les intégrer dans V2 ?
- le format du QR code doit-il être conservé tel quel ?

### Prochaine action

Attendre les réponses du propriétaire, puis concevoir l'adaptateur ou l'intégration choisie.

### Commandes/tests restants

- `cd server && npm test` (à relancer après chaque modification serveur).
- `node tests/qa-permanent-preview.cjs` (à relancer après chaque modification front).

---

## 10. Instructions pour une nouvelle session

Si tu reprends ce projet dans une nouvelle session Kimi Code :

1. **Lis d'abord ce fichier** (`PROJECT-CONTINUITY.md`) pour comprendre l'état actuel.
2. Vérifie la branche courante : `git branch --show-current`.
3. Vérifie l'état du dépôt : `git status --short` et `git log --oneline -5`.
4. Relis `coordination/STATUS_V2.md` pour le contexte des étapes.
5. Relis `docs/CARDS_IMMUTABILITY.md` avant toute intervention sur les cartes.
6. Ne modifie rien en production ; travaille toujours en local.
7. Mets à jour `PROJECT-CONTINUITY.md` après chaque avancée.

---

*Dernière mise à jour : 16 août 2026.*
