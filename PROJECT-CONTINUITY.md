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
2. Intégrer la production de cartes élèves dans V2 (**FAIT**).
3. Construire l'application de contrôle centrale des tokens d'instance (**FAIT**).
4. Rédiger la fiche de lancement de l'application (**EN COURS**).

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
- **Décision d'architecture** : la production physique des cartes (téléchargement + impression) se fait dans l'**application de contrôle des tokens** (app centrale).
- **Flux validé** :
  1. V2 génère la carte (image/PDF) avec le moteur existant.
  2. V2 n'a **pas** de bouton "Imprimer" ; seul un bouton "Demander l'impression" est disponible.
  3. La carte est stockée dans **R2** dans un bucket privé dédié (`cards/{school_id}/{année}/{student_id}/`).
  4. V2 crée une demande d'impression dans la base locale.
  5. V2 pousse la demande vers l'app centrale via une API sécurisée avec une URL signée R2.
  6. L'app centrale télécharge la carte et gère l'impression physique.
  7. L'app centrale confirme le statut à V2.
- **Accès R2** : seul l'app centrale peut télécharger les fichiers finis ; V2 génère des URLs signées à durée limitée.
- **Mode de transmission** : **push API directe** validé. V2 appelle l'app centrale dès qu'une carte est prête, avec file d'attente locale en cas d'échec.
- **Authentification V2 ↔ app centrale** : **HMAC signé avec timestamp** recommandé (plus sûr qu'une clé API simple, résistant au replay).
- **Durée URL signée R2** : **72 heures** (suffisant pour un opérateur humain, court pour limiter les risques).
- **Gestion des échecs** : retry exponentiel (1 min, 5 min, 15 min), puis statut `failed` ; notification à l'admin principal ; possibilité de relancer manuellement.
- **Format de sortie** : **PNG HD** ; deux images séparées (`front.png`, `back.png`) dans un dossier nommé par école + élève.
- **Structure R2** : `cards/{school_slug}/{academic_year}/{student_matricule}_{student_name}/front.png` et `back.png`.
- **Polices** : **hébergées localement sur le VPS** pour fonctionner hors ligne et éviter la dépendance à Google Fonts.
- **Validation** : oui, l'admin principal ou la personne autorisée valide visuellement avant envoi.
- **Paiement** : inclus dans l'abonnement.
- **Nommage** : le nom "zalavrai" ne doit **pas** apparaître dans l'application V2. On parle du **moteur de cartes SchoolSafe historique** ou du **sous-système de cartes**.
- **Code source disponible** : seul le fichier monolithique est disponible ; il servira de référence pour construire l'adaptateur sans réimplémentation.
- **QR code et tuteurs** : le format `schoolsafe://student/{matricule}` est conservé. La carte identifie le **tuteur principal** et les **autres tuteurs** pour la récupération des élèves. Les informations tuteurs apparaissent sur le verso.
- **Scan et présence** : le scan d'entrée/sortie crée automatiquement les **listes de présence** pour toutes les salles de classe.
- **Archivage des scans** : les scans de plus de **3 mois** seront déplacés vers **R2** pour alléger la base Supabase.
- **Patrimoines visuels** : ce sont des éléments de design intégrés à la carte ; ils seront extraits du fichier de référence pour l'adaptateur.

### Sécurité

- RLS sur toutes les tables sensibles.
- Aucun multi-tenant complexe : une base = une école.
- L'interface ne constitue pas une barrière de sécurité ; l'autorité définitive est côté serveur et base.

### Rôles et permissions

- **Double rôle possible pour tous les postes** : une personne peut cumuler plusieurs rôles (parent + enseignant, enseignant + secrétariat, etc.).
- Les permissions se calculent par **union** des droits de tous les rôles.
- Les périmètres se calculent par **union** des périmètres de chaque rôle.
- L'interface indique les rôles actifs ou fusionne les contextes de manière transparente.
- Chaque action reste soumise à la permission correspondante : un parent qui est aussi enseignant ne peut pas modifier une note en tant que parent, seulement la consulter.

---

## 3. Idées et demandes

### Idées déjà réalisées

- Token de setup pour contrôler l'ouverture de la configuration.
- Connexion téléphone résolue en e-mail côté VPS.
- Schéma Supabase pour l'Étape 2.
- API VPS avec endpoints de setup et d'authentification.

### Idées en attente de développement

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

### Sous-système de cartes — schéma de données

- Migration Supabase créée : `supabase/migrations/202608160002_card_system.sql`.
- Tables créées : `classes`, `students`, `student_guardians`, `card_print_requests`.
- Colonnes ajoutées à `students` : `card_printed`, `card_print_date`, `card_print_count`.
- RLS activées sur les 4 nouvelles tables.
- Tests serveur existants toujours verts (26/26).

### Sous-système de cartes — extraction des assets

- Migration `supabase/migrations/202608160003_card_design_fields.sql` créée : ajout de `card_family`, `card_variant`, `card_pat_style` dans `classes`.
- 60 images patrimoine téléchargées dans `app/modules/cards/assets/patrimoine/`.
- CSS des cartes extrait dans `app/modules/cards/assets/cards.css`.
- Données de design (familles, variantes, palette, patrimoines) créées dans `app/modules/cards/assets/card-data.js`.
- Script de téléchargement des patrimoines : `scripts/download-patrimoines.py`.

### Sous-système de cartes — test visuel autonome

- Fichier `app/modules/cards/test-card.html` créé : page autonome qui reproduit le rendu badge vertical et carte PVC horizontale avec des données de test.
- Charge le CSS local, les données design `card-data.js`, et les librairies `qrcodejs` + `html2canvas` depuis CDN.
- Permet de changer la classe test, la famille de design (A-J), la variante de couleur et le style de patrimoine (vignette/fond/both).
- Permet de capturer le PNG en haute définition (scale 2).
- Servi localement par `app/server.mjs` sur `http://127.0.0.1:4175/modules/cards/test-card.html`.

### Application de contrôle centrale finalisée (Render + Neon)

- Dossier `control-app/` à la racine du dépôt, stack TypeScript + Fastify + Vitest alignée sur `server/`.
- Base de données : **Neon PostgreSQL** en production, **SQLite** en local/test via une abstraction commune (`src/db/index.ts`, `src/db/postgres.ts`, `src/db/sqlite.ts`).
- Schémas SQL créés :
  - `src/db/schema.sql` (PostgreSQL) ;
  - `src/db/schema.sqlite.sql` (SQLite).
- Tableau de bord opérateur dans `control-app/public/` (`index.html`, `styles.css`, `app.js`, `logo.png`).
- Déploiement Render + Docker : `Dockerfile`, `render.yaml`, `control-app/DEPLOY.md`.
- Routes admin (protégées par `x-admin-token`) :
  - `POST /instances` : créer une instance (génère `setup_token` + `hmac_secret`) ;
  - `GET /instances` et `GET /instances/:id` : lister / détail ;
  - `POST /instances/:id/token` : régénérer le token de setup ;
  - `POST /instances/:id/revoke-hmac` : régénérer le secret HMAC ;
  - `POST /instances/:id/block` et `/unblock` : bloquer / débloquer.
- Routes VPS (protégées par HMAC signé) :
  - `POST /card-print-requests` : recevoir une demande d'impression de carte ;
  - `GET /card-print-requests` : lister les demandes (admin) ;
  - `POST /card-print-requests/:id/print` : marquer comme imprimée ;
  - `POST /card-print-requests/:id/fail` : marquer comme échouée.
- Vérification HMAC : `method + path + timestamp + JSON.stringify(body)`, avec fenêtre de 5 minutes.
- Vérifications passées :
  - `cd control-app && npm run typecheck` ✅
  - `cd control-app && npm test` ✅ 8/8
  - `cd control-app && npm run build` ✅
  - `cd server && npm test` ✅ 31/31
  - Test visuel Playwright du dashboard : `tmp/card-previews/control-app-dashboard.png` ✅
- Commit et push sur `origin/main` : `92b1230 feat(control-app): finalisation de l'app centrale (Render + Neon)`.
- **Migration vers un dépôt dédié** : le dossier `control-app/` a été déplacé dans le dépôt `https://github.com/medygoo/schoolsafe-control-.git` (commit `a1a91f7`).
- Nettoyage du dépôt principal : suppression du dossier `control-app/` et mise à jour de la documentation.

### Interface de gestion des écoles dans l'app centrale

- Dépôt concerné : `https://github.com/medygoo/schoolsafe-control-.git`.
- Fichiers modifiés :
  - `public/index.html` : ajout des onglets **Demandes d’impression** et **Gestion des écoles**, formulaire de création d’école, tableau des instances.
  - `public/app.js` : logique des onglets, création d’école, copie token/HMAC, régénération token/HMAC, blocage/déblocage.
  - `public/styles.css` : styles des onglets, du tableau d’instances et du formulaire.
  - `src/db/index.ts` : correction du chemin SQLite par défaut (`DATA_DIR` est un répertoire, pas un fichier).
  - `src/db/sqlite.ts` : création automatique du répertoire parent de la base SQLite.
- Corrections de stabilité :
  - Le serveur local pouvait planter au premier démarrage si le répertoire `data/` n’existait pas ; il crée désormais le répertoire parent automatiquement.
  - Le chemin par défaut de la base SQLite est maintenant cohérent : `${DATA_DIR}/control-app.db`.
- Vérifications effectuées :
  - `npm run typecheck` ✅
  - `npm run build` ✅
  - Tests API locaux : `GET /instances`, `POST /instances`, `POST /instances/:id/block`, `POST /instances/:id/unblock` ✅
  - Interface web servie correctement sur `http://127.0.0.1:4176` ✅
- Commit et push sur `main` : `646fdb3 feat(control): interface de gestion des écoles + fix SQLite local`.

### Intégration front du moteur de cartes dans V2

- Module ES réutilisable créé : `app/modules/cards/card-renderer.js` (exporte `renderCardPreview`, `captureCardPng`, `ssClassType`, etc.).
- Module d'intégration workspace créé : `app/modules/cards/cards-module.js` :
  - charge les classes et élèves depuis Supabase ;
  - adapte les données V2 au format du moteur historique ;
  - affiche l'aperçu recto/verso avec les couleurs/patrimoines par classe ;
  - capture les images PNG via `html2canvas` ;
  - envoie la demande d'impression au VPS via `POST /cards/request-print`.
- `app/index.html` : bouton "Cartes élèves" dans la sidebar, section `<section id="cardsStudio">`, chargement des libs et du module.
- `app/app.js` : appel de `window.SchoolSafeCards.init()` dans `renderWorkspace()`.
- `app/modules/cards/assets/cards.css` : styles du studio de production de cartes ajoutés.
- Tests visuels automatisés :
  - `app/modules/cards/test-card.html` : rendu badge + carte validé par capture Playwright ;
  - intégration V2 : le studio s'affiche correctement dans le workspace.
- Ajustements de finalisation des cartes :
  - logo SchoolSafe en bas des deux faces (recto et verso) via un chemin absolu `/schoolsafe-logo.png` pour fonctionner dans le PWA et la page de test ;
  - site web de l'école affiché sur le recto de la carte PVC et dans le bloc contact du verso ;
  - e-mail SchoolSafe `schoolsafe1@gmail.com` affiché sur le verso (badge et carte) ;
  - suppression du label "Badge élève — Verso" pour ne pas gêner l'impression.

### Double rôle — logique de permissions et guard serveur

- Décision validée : **deny l’emporte** en cas de conflit entre rôles.
- Migration Supabase créée : `supabase/migrations/202608170001_permission_deny_logic.sql`.
  - Mise à jour de `has_permission(permission_code)` : une permission est accordée si au moins un rôle l’autorise (`allowed = true`) et aucun rôle ne la refuse explicitement (`allowed = false`).
- Service d’accès côté serveur : `server/src/access/service.ts`.
  - `hasPermission(token, code)` : appelle la fonction SQL `has_permission` via RPC Supabase.
  - `hasScope(token, type, id)` : appelle la fonction SQL `has_scope` via RPC Supabase.
- Guard Fastify : `server/src/access/guard.ts`.
  - Extraction du bearer token.
  - Vérification de la permission et du périmètre avant d’exécuter une route.
  - Codes d’erreur `ACCESS_DENIED` et `SCOPE_DENIED` ajoutés.
- Intégration dans `server/src/app.ts` : option `access` et route de test protégée `/__test/protected`.
- Tests unitaires : `server/tests/access-guard.test.ts` (5/5 passent).
- Vérifications : `npm run typecheck` ✅ et `npm test` ✅ 36/36.

### Double rôle — sélecteur de rôle actif et deny override dans le bootstrap

- Décisions validées :
  - sélecteur de rôle actif dans le workspace ;
  - comportement contextuel selon le module (ex. enseignant + parent) ;
  - rôles personnalisables par l’admin principal.
- Côté serveur (`server/src/bootstrap/service.ts`) :
  - calcul des permissions effectives par union des rôles avec **deny override** ;
  - une permission autorisée par un rôle et refusée explicitement par un autre est retirée de la liste envoyée au front.
- Côté front (`app/app.js`) :
  - le workspace affiche un sélecteur de rôle actif basé sur les vrais rôles du bootstrap ;
  - le choix est persisté dans `localStorage` (`schoolsafe-v2-active-role`) ;
  - si un seul rôle, le sélecteur est masqué/désactivé.
- Tests :
  - `server/tests/bootstrap.test.ts` : test multi-rôle avec plusieurs rôles, permissions et scopes.
  - Tous les tests serveur passent : **39/39**.
  - Test QA permanent preview : **3/3**.
- Commit et push : `ffeaeb6 feat(double-role): selecteur de role actif et deny override dans le bootstrap`.

### Module Finance — démonstration front existante

- Le front PWA dispose déjà d’un espace financier complet en démonstration :
  - `app/app.js` : état local `financeState`, onglets (vue financière, structure des frais, encaissements, reçus, soldes, rapports, famille), rendu PDF des reçus et rapports de caisse.
  - `app/index.html` : section `financeModule` avec navigation par rôle.
  - Rôles couverts : responsable financier, agent de caisse, comptable, parent, chef d’établissement.
  - Fonctions simulées : structure des frais, encaissements, reçus, soldes, clôture de caisse, contrôle de régularité scolaire sans montant.
- **Ce qui manque** : backend serveur et tables Supabase pour rendre ces fonctions persistées et multi-utilisateurs.
- La migration `202608170004_fee_control.sql` apporte les tables de données nécessaires (`fee_structures`, `student_fees`, `fee_payments`) pour remplacer l’état local par du stockage réel.

### Incrément B — Sécurité QR + Moteur d’alertes + Contrôle des frais par QR

- Décision validée : unifier en un seul incrément B les trois briques :
  1. **Sécurité QR** : scan entrée/sortie, vérification HMAC, personnes autorisées, lockdown global par école, notifications parents à la sortie.
  2. **Moteur d’alertes** : règles configurables, déduplication, routage par **rôle ET par utilisateur**, sévérité critique/important/attention/information.
  3. **Contrôle des frais par QR** : campagnes de contrôle créées par l’admin général, assignation de contrôleurs, scan QR pour vérifier le statut financier sans créer de paiement.
- Règles métier validées :
  - Le QR contient un numéro de carte + signature HMAC calculée côté serveur (`schoolsafe://card/{card_number}/{signature}`) ; jamais de données personnelles en clair.
  - Seul le serveur crée les numéros de carte et les signatures.
  - Le gardien compare physiquement la personne avant d’autoriser une sortie.
  - Une sortie refusée ou non autorisée déclenche une alerte critique immédiate.
  - Le lockdown global bloque toutes les sorties, même avec carte et autorisations valides.
  - Les notifications parents à la sortie ne contiennent que l’essentiel (nom de l’enfant, heure de sortie), jamais de données sensibles dans les pushes.
  - Les alertes financières ne sont jamais envoyées aux gardiens ; chaque rôle/utilisateur ne voit que les alertes de son domaine.
  - Les devises supportées sont **USD** et **CDF**.
  - Plusieurs postes/portes (`locations`) peuvent exister par école.
- Migrations SQL créées (non commitées) :
  - `supabase/migrations/202608170003_security_and_alerts.sql` : `locations`, `student_cards`, `security_events`, `alert_rules`, `alerts`, `alert_notifications`, lockdown dans `school_settings`, règles système par défaut.
  - `supabase/migrations/202608170004_fee_control.sql` : `fee_structures`, `student_fees`, `fee_payments`, `fee_control_campaigns`, `fee_control_assignees`, `fee_control_scans`.
- Points d’attention :
  - Brevo doit être ajouté aux variables d’environnement serveur (`server/src/config/env.ts`).
  - La clé HMAC des cartes (`CARD_HMAC_SECRET`) doit être définie dans les secrets de l’instance.
  - Le module Finance existait jusqu’ici sous forme de démo front ; les tables backend sont créées par la migration B2.

### Envoi batch des cartes vers l'app centrale

- Migration Supabase : `supabase/migrations/202608170002_card_print_version.sql`.
  - Ajout de `version` et `is_duplicate` sur `card_print_requests`.
  - Fonction atomique `increment_card_print_count(student_id)` qui retourne la nouvelle version.
- Service carte côté serveur (`server/src/cards/service.ts`) :
  - passage de l’envoi unitaire à l’envoi batch (`requestPrintBatch`) ;
  - calcul de la version par incrément atomique en base ;
  - stockage R2 versionné : `cards/{schoolSlug}/{year}/{matricule}/v{version}/{requestId}/front.png` et `back.png` ;
  - envoi du numéro de version et du flag `is_duplicate` à l’app centrale.
- Schéma Zod (`server/src/cards/schema.ts`) : accepte un objet unique ou un tableau de 1 à 100 demandes.
- Route `/cards/request-print` protégée par le guard de permission `cards.request.print`.
- Permission ajoutée au catalogue : `shared/permissions.json`.
- Tests serveur : `server/tests/cards.test.ts` étendus avec tests batch et permission denied.
- Front PWA (`app/modules/cards/cards-module.js`) :
  - liste d’élèves avec cases à cocher ;
  - case “Tout sélectionner” ;
  - indicateur “incomplet” si photo ou tuteur manquant ;
  - génération séquentielle des aperçus/captures pour chaque élève sélectionné ;
  - envoi batch au VPS.
- Styles associés dans `app/modules/cards/assets/cards.css`.
- HTML mis à jour dans `app/index.html`.
- Vérifications : `npm run typecheck` ✅ et `npm test` ✅ 38/38.

### Connexion V2 → app centrale pour les cartes

- Endpoint VPS créé : `POST /cards/request-print` dans `server/src/cards/routes.ts`.
- Service `CardService` dans `server/src/cards/service.ts` :
  - reçoit les images recto/verso en base64 du front PWA ;
  - les upload dans R2 (`cards/{school_slug}/{année}/{matricule}/front.png` + `back.png`) ;
  - génère des URLs signées valables 72h ;
  - crée un enregistrement dans `card_print_requests` ;
  - pousse la demande à l'app centrale via HMAC signé ;
  - met à jour `students.card_printed`, `card_print_date`, `card_print_count`.
- Client HMAC pour l'app centrale : `server/src/control-app/client.ts`.
- Service R2 : `server/src/storage/r2.ts` avec `@aws-sdk/client-s3`.
- Variables d'environnement ajoutées dans `server/src/config/env.ts` :
  - `CONTROL_APP_URL`, `CONTROL_APP_INSTANCE_ID`, `CONTROL_APP_HMAC_SECRET` ;
  - `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_CARDS`.
- Authentification : la route vérifie le bearer token Supabase et résout le `profile_id`.
- Validation Zod des entrées (`server/src/cards/schema.ts`).
- Gestion des erreurs Zod transformée en `VALIDATION_INVALID` dans `server/src/app.ts`.
- Tests serveur : 31/31 passent (`npm test` dans `server/`).

### Fichiers importants créés ou modifiés

- `supabase/migrations/202608160001_step2_school_configuration.sql`
- `supabase/migrations/202608160002_card_system.sql`
- `supabase/migrations/202608160003_card_design_fields.sql`
- `supabase/migrations/202608170003_security_and_alerts.sql`
- `supabase/migrations/202608170004_fee_control.sql`
- `server/src/setup/schema.ts`
- `server/src/setup/service.ts`
- `server/src/setup/routes.ts`
- `server/src/config/env.ts`
- `server/src/app.ts`
- `server/src/index.ts`
- `server/src/http/errors.ts`
- `server/src/auth/profile.ts`
- `server/src/cards/schema.ts`
- `server/src/cards/service.ts`
- `server/src/cards/routes.ts`
- `server/src/control-app/client.ts`
- `server/src/storage/r2.ts`
- `server/tests/setup.test.ts`
- `server/tests/cards.test.ts`
- `app/app.js`
- `app/index.html`
- `app/modules/cards/assets/cards.css`
- `app/modules/cards/assets/card-data.js`
- `app/modules/cards/assets/patrimoine/*.png`
- `app/modules/cards/card-renderer.js`
- `app/modules/cards/cards-module.js`
- `app/modules/cards/test-card.html`
- `docs/LAUNCH.md`
- `coordination/STATUS_V2.md`

### Merges et pushes

- Tout a été poussé sur `origin/main`.
- Dépôt principal : `https://github.com/medygoo/schoolsafemm.git`
- Dépôt app centrale : `https://github.com/medygoo/schoolsafe-control-.git`
- Commits récents sur `schoolsafemm` :
  - `b472483 feat(finance): backend controle des frais par QR`
  - `737399a feat(email): service d'envoi Brevo avec fallback noop`
  - `cfc34e1 feat(pilotage): moteur d'alertes et tableau de bord`
  - `171042f feat(security): backend scan QR, lockdown et routes securisees`
  - `89093a6 feat(pilotage): migrations et decisions pour increment B`

### Incrément B — Backend terminé

- **Sécurité QR** (`server/src/security/`) :
  - Vérification HMAC du QR `schoolsafe://card/{card_number}/{signature}`.
  - Routes `POST /security/scan`, `POST /security/lockdown`, `GET /security/events`.
  - Gestion du lockdown global par école.
  - Création automatique d’alertes critiques sur sortie refusée et incident.
- **Moteur d’alertes + Pilotage** (`server/src/pilotage/`) :
  - Tables `alerts`, `alert_rules`, `alert_notifications` créées par migration.
  - Routes `GET /pilotage/dashboard`, `GET /pilotage/alerts`, `POST /pilotage/alerts/:id/acknowledge`, `POST /pilotage/alerts/:id/resolve`.
  - Déduplication via index unique partiel sur les alertes actives.
- **Email Brevo** (`server/src/email/`) :
  - Service `createBrevoEmailService` utilisant l’API Brevo v3 avec `fetch`.
  - Fallback `createNoopEmailService` si `BREVO_API_KEY` n’est pas configuré.
  - Route `POST /email/send` protégée par permission.
- **Contrôle des frais par QR** (`server/src/finance/control/`) :
  - Routes `/finance/fee-structures`, `/finance/student-fees`, `/finance/payments`, `/finance/fee-control/campaigns`, `/finance/fee-control/scans`.
  - Création de campagnes avec assignation de contrôleurs.
  - Scan QR pour vérifier le statut financier sans créer de paiement.
- **Permissions** : toutes les permissions nécessaires ajoutées à `shared/permissions.json`.
- **Variables d’environnement** : `CARD_HMAC_SECRET`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` ajoutées à `server/src/config/env.ts`.
- **Tests serveur** : 58/58 passent.

---

## 5. Travail en cours

### Tâche exacte

**Incrément B — Frontend** : connecter et adapter le front PWA pour le scan QR, les alertes et le contrôle des frais.

### État d'avancement

- Backend sécurité / alertes / email / contrôle des frais terminé et poussé sur `main`.
- Front finance existe déjà en démo locale ; il doit être connecté au backend.
- Front scan QR / alertes / contrôle frais non encore adapté.

### Fichiers concernés

- `app/app.js`
- `app/index.html`
- `app/modules/security/` (à créer)
- `app/modules/pilotage/` (à créer)
- `app/modules/finance/` (à créer ou adapter)

### Prochaine action immédiate

1. Lancer le test QA permanent preview.
2. Adapter le front pour le scan QR et l’affichage des alertes.
3. Connecter le front finance existant au backend.
4. Adapter le front pour le contrôle des frais par QR.
6. Adapter le front PWA.
7. Lancer `cd server && npm run typecheck && npm test` et `node tests/qa-permanent-preview.cjs`.

---

## 6. Travail restant

### Fonctionnalités non terminées

- Connexion du front finance existant aux nouvelles tables backend.
- Front scan QR, alertes et contrôle des frais.
- Notifications push/Web Push pour les alertes.

### Améliorations prévues

- Gestion avancee du double role : affichage contextuel par module (enseignant vs parent), filtrage des actions selon le contexte.
- Tests de contrat pour l'adaptateur cartes.
- Documentation de l'interface du systeme de cartes.
- Gestion des duplicatas et de l'historique d'impression.
- Fiche de lancement de l'application (`docs/LAUNCH.md` a completer).

### Prochaines étapes logiques

1. Gestion avancée du double rôle (affichage contextuel par module).
2. Documenter l'interface d'entrée/sortie du système de cartes.
3. Créer l'adaptateur versionné avec tests de contrat.
4. Poursuivre l'étude détaillée des fonctionnalités une par une (finance, pédagogie, sécurité, etc.).

---

## 7. Architecture actuelle

### Frontend

- PWA dans `app/` :
  - `index.html` : structure des écrans
  - `app.js` : logique principale (splash, auth, setup, workspace, modules)
  - `styles.css` : styles
  - `i18n.js` : internationalisation
  - `offline-sync.js` : synchronisation hors connexion
  - `modules/cards/cards-module.js` : studio de production de cartes élèves
  - `modules/cards/card-renderer.js` : moteur de rendu des cartes (badge + carte PVC)
- Serveur local `app/server.mjs` sur `127.0.0.1:4175`.
- **App centrale** : dans le dépôt séparé `https://github.com/medygoo/schoolsafe-control-.git`.

### Backend

- **API école** : Fastify dans `server/src/`, exécutée sur le VPS de l'école :
  - `auth/` : vérification Supabase
  - `bootstrap/` : chargement du contexte utilisateur
  - `setup/` : création de l'école et de l'administrateur
  - `cards/` : gestion des demandes d'impression de cartes
  - `health/` : points de contrôle
  - `http/` : gestion des erreurs
- **App centrale** : Fastify dans le dépôt séparé `schoolsafe-control-`, exécutée sur Render :
  - `db/` : abstraction PostgreSQL (Neon) / SQLite
  - `routes/instances.ts` : gestion des écoles et tokens
  - `routes/card-requests.ts` : réception et traitement des demandes d'impression
  - `auth/hmac.ts` : vérification des signatures HMAC des VPS écoles
  - `auth/admin.ts` : authentification du tableau de bord opérateur

### Supabase / PostgreSQL

- Tables existantes : `school`, `school_settings`, `profiles`, `devices`, `roles`, `permissions`, `profile_roles`, `role_permission_grants`, `scope_assignments`, `audit_events`.
- Tables ajoutées pour l'Étape 2 : `academic_years`, `school_cycles`, `school_contacts`.
- Tables ajoutées pour les cartes : `classes`, `students`, `student_guardians`, `card_print_requests`.
- Tables ajoutées pour l’incrément B (sécurité + alertes) : `locations`, `student_cards`, `security_events`, `alert_rules`, `alerts`, `alert_notifications`.
- Tables ajoutées pour l’incrément B (contrôle des frais) : `fee_structures`, `student_fees`, `fee_payments`, `fee_control_campaigns`, `fee_control_assignees`, `fee_control_scans`.
- Colonnes ajoutées à `school`, `profiles`, `school_settings` (lockdown).

### Authentification

- Supabase Auth avec e-mail + mot de passe.
- Téléphone résolu en e-mail via endpoint `/auth/lookup-phone` sur le VPS.

### Stockage

- R2 pour les fichiers lourds.
- VPS pour le logo et les documents temporaires.

### API

**API école (`server/src/`)**

- `GET /config` : configuration Supabase pour le front.
- `POST /session/bootstrap` : contexte de session.
- `POST /setup/validate-token` : validation du token de setup.
- `POST /setup/school` : création de l'école.
- `POST /setup/admin` : création de l'administrateur.
- `POST /auth/lookup-phone` : recherche d'e-mail par téléphone.
- `POST /cards/request-print` : réception d'une demande d'impression de carte, upload R2, push HMAC vers l'app centrale.
- `POST /security/scan` : vérification d’un QR scolaire et enregistrement d’un événement de sécurité (entrée/sortie/refus).
- `GET /security/events` : historique des scans et événements.
- `POST /security/lockdown` : activation/désactivation du lockdown global.
- `GET /pilotage/dashboard` : KPI, alertes et approbations du jour.
- `GET /pilotage/alerts` : file d’alertes.
- `POST /pilotage/alerts/:id/acknowledge` : prise en charge d’une alerte.
- `POST /pilotage/alerts/:id/resolve` : résolution d’une alerte.
- `GET /pilotage/approvals` : demandes d’approbation en attente.
- `POST /pilotage/approvals/:id/decision` : décision sur une demande d’approbation.
- `GET /finance/fee-structures` : grille des frais.
- `POST /finance/fee-structures` : créer un type de frais.
- `GET /finance/student-fees` : situation financière des élèves.
- `POST /finance/payments` : enregistrer un paiement.
- `GET /finance/fee-control/campaigns` : campagnes de contrôle des frais.
- `POST /finance/fee-control/campaigns` : créer une campagne.
- `POST /finance/fee-control/scans` : enregistrer un scan de contrôle des frais.

**App centrale (dépôt `schoolsafe-control-`)**

- `POST /instances` : créer une école/instance.
- `GET /instances` / `GET /instances/:id` : lister / détail.
- `POST /instances/:id/token` : régénérer le token de setup.
- `POST /instances/:id/revoke-hmac` : régénérer le secret HMAC.
- `POST /instances/:id/block` / `/unblock` : bloquer / débloquer l'instance.
- `POST /card-print-requests` : recevoir une demande d'impression d'un VPS école.
- `GET /card-print-requests` : lister les demandes pour l'opérateur.
- `POST /card-print-requests/:id/print` : marquer comme imprimée.
- `POST /card-print-requests/:id/fail` : marquer comme échouée.

### RLS et permissions

- RLS activé sur toutes les tables sensibles.
- Fonctions utilitaires : `current_profile_id()`, `current_school_id()`, `has_permission()`, `has_scope()`.
- Périmètres : cycle, classe, matière, service, portail, enfants rattachés.

### Services externes

- **Brevo** : e-mails transactionnels.
- **Supabase** : base de données et authentification de l'école.
- **R2** : stockage de fichiers lourds (cartes, photos, archives).
- **Render.com** : hébergement de l'app centrale.
- **Neon.tech** : base de données PostgreSQL de l'app centrale (plan gratuit).

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

Backend de l’incrément B entièrement implémenté, testé et poussé sur `main`. `PROJECT-CONTINUITY.md` synchronisé. Le front PWA n’est pas encore adapté pour le scan QR, les alertes et le contrôle des frais.

### Ce que j'étais en train de faire

- Implémenter le backend sécurité QR (`server/src/security/`).
- Implémenter le moteur d’alertes et le tableau de bord (`server/src/pilotage/`).
- Implémenter le service email Brevo (`server/src/email/`).
- Implémenter le backend contrôle des frais (`server/src/finance/control/`).
- Mettre à jour `PROJECT-CONTINUITY.md`.
- Lancer les tests serveur (58/58 passent).

### Prochaine action

1. Commiter et pousser la mise à jour de `PROJECT-CONTINUITY.md`.
2. Lancer `node tests/qa-permanent-preview.cjs`.
3. Passer au frontend : scan QR, alertes, contrôle des frais, connexion finance.

### Commandes/tests restants

- `node tests/qa-permanent-preview.cjs`
- Adapter le front PWA.

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

*Dernière mise à jour : 17 août 2026 — backend de l’incrément B terminé (sécurité QR, alertes, email Brevo, contrôle des frais par QR) ; 58 tests serveur passent ; front PWA à adapter.*
