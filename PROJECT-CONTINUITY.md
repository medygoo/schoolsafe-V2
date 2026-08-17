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
  - `5223993 refactor: move control-app to dedicated repo schoolsafe-control-`
  - `5f12a64 docs: finalize PROJECT-CONTINUITY and add LAUNCH.md`
  - `92b1230 feat(control-app): finalisation de l'app centrale (Render + Neon)`

---

## 5. Travail en cours

### Tâche exacte

**Migration de l'app centrale vers son propre dépôt et mise à jour de la documentation** : déplacer `control-app/` vers `https://github.com/medygoo/schoolsafe-control-.git`, nettoyer le dépôt principal, mettre à jour `docs/LAUNCH.md` et `PROJECT-CONTINUITY.md`.

### État d'avancement

- Intégration front du moteur de cartes terminée et testée visuellement.
- Application de contrôle centrale finalisée et poussée sur `origin/main`.
- App centrale migrée dans le dépôt dédié `schoolsafe-control-`.
- Dépôt principal nettoyé (`control-app/` supprimé).
- Documentation en cours de mise à jour.
- Fichier complet téléchargé localement : `analysis/zalavrai.html` (~2,2 Mo).
- Analyse technique complète réalisée (section détaillée ci-dessous).
- Architecture des cartes verrouillée :
  - V2 génère la carte finie (PNG/PDF) dans le **front PWA** avec `html2canvas`.
  - V2 n'a pas de bouton "Imprimer" ; seul "Demander l'impression" existe.
  - Stockage dans R2 (bucket privé `cards/`).
  - L'app centrale télécharge via URL signée et imprime.
  - Validation obligatoire avant envoi.
- **Génération d'image validée** : dans le **front PWA** (Option A).
- Modèle de double rôle validé : union des permissions et des périmètres.
- Contraintes métier ajoutées :
  - le nom "zalavrai" ne doit pas apparaître dans V2 ;
  - le QR code identifie le tuteur principal et les autres tuteurs pour la récupération des élèves ;
  - le scan d'entrée/sortie crée automatiquement les listes de présence ;
  - les scans de plus de 3 mois sont archivés dans R2.
- Technologies confirmées : `qrcodejs`, `html2canvas`, `jszip`, `html2pdf.js`.
- Deux formats physiques confirmés :
  - **Badge vertical** : 340 × 540 px — Maternelle → 4ᵉ Primaire.
  - **Carte PVC horizontale** : 560 × 353 px — 5ᵉ/6ᵉ Primaire + Humanités/Secondaire.
- QR code sur la carte (non signé) : `schoolsafe://student/{matricule}`.
- QR code au scan (signé) : `schoolsafe://student/{matricule}/{YYYYMMDD}/{sig8}` avec HMAC-SHA256.
- Processus de production : aperçu recto/verso → capture html2canvas scale 2 → assemblage recto+verso → upload Supabase Storage (`photos/cards/`) → marquage élève `card_printed`, `card_print_date`, `card_print_count`.
- Duplicata géré avec tampon `DUPLICATA` et incrément du compteur.
- **La création de cartes est déjà fonctionnelle et terminée dans le moteur historique** ; il ne s'agit pas de le réinventer, mais de le brancher proprement dans V2.
- **V2 possède déjà deux systèmes de scan** :
  - scan pour contrôle de frais ;
  - scan pour contrôle d'arrivée et de sortie de classe.
- **Décision d'architecture prise** : la production physique (téléchargement + impression) se fait dans l'**application de contrôle des tokens**. SchoolSafe V2 prépare et transmet la demande.
- Mode de transmission validé : **push API directe** avec clé API et file d'attente locale.
- Choix techniques validés :
  - authentification HMAC signé avec timestamp ;
  - URL R2 signées 72 heures ;
  - retry exponentiel puis `failed` ;
  - PNG HD, deux fichiers `front.png` + `back.png` ;
  - dossier R2 nommé par école + élève ;
  - polices hébergées localement sur le VPS.
- **Schéma Supabase terminé** : tables `classes`, `students`, `student_guardians`, `card_print_requests` créées avec RLS.
- **Analyse design/couleur par classe terminée** :
  - 10 familles de design globales (A-J) avec 4 variantes chacune ;
  - 60 patrimoines visuels regroupés en 5 thèmes ;
  - chaque classe peut définir `card_color`, `card_color_soft`, `card_color_dark` ;
  - chaque classe peut choisir un patrimoine (`card_pat`) ou laisser le mode `auto` ;
  - le format badge/carte est déterminé par le cycle + le nom de la classe ;
  - champs déjà présents dans `classes` : `card_color`, `card_color_soft`, `card_color_dark`, `card_pat` ;
  - champs à ajouter pour reproduire fidèlement : `card_family`, `card_variant`, `card_pat_style`.
- **Assets extraits** :
  - migration `202608160003_card_design_fields.sql` avec `card_family`, `card_variant`, `card_pat_style` ;
  - 60 images PNG dans `app/modules/cards/assets/patrimoine/` ;
  - CSS dans `app/modules/cards/assets/cards.css` ;
  - données design dans `app/modules/cards/assets/card-data.js`.
- **Test visuel créé** : `app/modules/cards/test-card.html` sert les cartes en local sur `http://127.0.0.1:4175/modules/cards/test-card.html`.
- **Application de contrôle des tokens créée** : `control-app/` avec routes admin et HMAC, tests 8/8 passants.
- **Connexion V2 → app centrale côté VPS** : endpoint `/cards/request-print` créé, push HMAC vers l'app centrale, tests serveur 31/31 passants.
- Sorties : PNG recto+verso, impression navigateur (PDF via print), liste de distribution classe.

### Synthèse technique du système de cartes

#### Dépendances externes (CDN)
- `qrcodejs 1.0.0`
- `jsqr 1.4.0`
- `jszip 3.10.1`
- `html2pdf.js 0.10.1`
- `html2canvas 1.4.1`
- Polices Google : `Baloo 2`, `Nunito Sans`, `DM Sans`

#### Fonctions principales identifiées
| Fonction | Rôle |
|----------|------|
| `window.ssClassType(cl)` | Choix badge/carte et index couleur |
| `window.ssBuildBadge(s,cl,teacher,year,patB,patStyle)` | HTML recto/verso badge |
| `window.ssBuildCarte(s,cl,teacher,year,patC,patStyle)` | HTML recto/verso carte |
| `window.ssGenQR(elId,data,size)` | Rendu QR code dans le DOM |
| `window.ssRenderPreview()` | Mise à jour de l'aperçu studio |
| `window.exportSSCardPNG()` | Export PNG via html2canvas |
| `window.ssPrintCard()` | Fenêtre d'impression navigateur |
| `window.printClassCards(cid)` | Impression d'une classe entière |
| `window.generateDuplicata(sid)` | Duplicata tamponné |
| `window.submitCardOrder(sid)` | Capture, upload, marquage impression |

#### Données élève requises
- `id`, `name`, `mat` (matricule), `dob` (YYYY-MM-DD), `photo`, `cid` (classe), `pid` (parent)
- `nom_papa` / `nom_maman` (fallback tuteur)
- `card_printed`, `card_print_date`, `card_print_count`

#### Données école requises
- `name`, `name_en`, `address`, `phone`, `email`, `motto`/`slogan`, `website`
- Logo école via `window.SCHOOL_LOGO` (base64 ou URL)

#### Données classe requises
- `name`, `cycle` (maternelle/primaire/humanites/secondaire), `option`
- `teacher_id` / `titulaire_id`
- `card_color`, `card_color_soft`, `card_color_dark`, `card_pat`
- `card_family` (A-J), `card_variant` (0-3), `card_pat_style` (vignette/fond/both)

#### Design et couleurs par classe
- **10 familles de design globales** (`A` à `J`) : Arc-en-ciel, Océan ludique, Pop Bento, Prestige Or, Ciel rêveur, Cahier d'écolier, Jungle Safari, Espace Galaxie, Bonbons Pastel, Tableau & Craie.
- **4 variantes de couleur** par famille (`FVARS`).
- **60 patrimoines visuels** répartis en 5 thèmes : Animaux de la RDC, Pierres & minerais, Animaux aquatiques, Animaux terrestres, Oiseaux.
- **Personnalisation par classe** : couleurs `card_color`/`soft`/`dark` + patrimoine `card_pat`.
- **Mode patrimoine** : `vignette` (image + nom), `fond` (arrière-plan), `both` (les deux).
- **Format badge/carte** déterminé par `ssClassType` selon le cycle et le nom de la classe :
  - Maternelle → badge ;
  - Humanités/Secondaire → carte ;
  - Primaire 1e-4e → badge ;
  - Primaire 5e-6e → carte.

#### Stockage et traçabilité
- Upload vers Supabase Storage : `POST ${SUPA_URL}/storage/v1/object/photos/cards/{filename}`
- Mise à jour base : `students.card_printed`, `students.card_print_date`, `students.card_print_count`

#### Flux V2 → application de contrôle des tokens (proposé)
1. Dans V2, l'admin/personne autorisée sélectionne un élève ou une classe et clique sur **"Demander l'impression"**.
2. V2 affiche un **aperçu final** de la carte recto/verso.
3. L'utilisateur **valide** l'aperçu.
4. V2 génère la carte (PNG/PDF) avec le moteur zalavrai via adaptateur.
5. V2 upload le fichier dans **R2** sous `cards/{school_id}/{academic_year}/{student_id}/{uuid}.png`.
6. V2 crée un enregistrement dans `card_print_requests` avec statut `pending`.
7. V2 appelle l'**API de l'app centrale** avec :
   - `school_id`, `request_id`, `student_id`, `student_name`, `class_name`
   - URL signée R2 à durée limitée
   - métadonnées de la carte (format, recto/verso, duplicata ou non)
8. L'app centrale reçoit la demande, la liste dans son tableau de bord.
9. L'opérateur dans l'app centrale **télécharge** la carte depuis R2 et **imprime**.
10. L'app centrale confirme à V2 le statut `printed` + date + référence d'impression.
11. V2 met à jour `students.card_printed`, `card_print_date`, `card_print_count`.

### Fichiers concernés

- `analysis/zalavrai.html` (analyse temporaire, non versionné pour l'instant).
- `docs/CARDS_IMMUTABILITY.md` (règles de protection).
- `PROJECT-CONTINUITY.md` (ce fichier).

### Problèmes rencontrés / Points de décision

- Le système historique est autosuffisant et contient tout le moteur graphique.
- `docs/CARDS_IMMUTABILITY.md` interdit formellement de réimplémenter ce moteur.
- Options d'intégration résolues : génération dans le front PWA, impression dans l'app de contrôle des tokens.
- Mapping cycle à adapter : `maternelle/humanites/secondaire/''` (historique) → `nursery/primary/secondary` (V2).

### Questions en attente de réponse du propriétaire

#### Cartes élèves (toutes répondues / verrouillées)

1. ✅ **Emplacement de la production de cartes** : dans l'**application de contrôle des tokens** (validé).
2. ✅ **Qui produit physiquement** : l'app de contrôle des tokens télécharge et imprime (validé).
3. ✅ **Contenu de la demande** : V2 génère la **carte finie** (image/PDF) et l'envoie à l'app centrale (validé).
4. ✅ **Stockage intermédiaire** : la carte transite par **R2** dans un bucket privé ; V2 génère des URLs signées pour l'app centrale (validé).
5. ✅ **Qui déclenche la demande dans V2** : l'**admin principal** ou la personne à qui il a donné accès (validé).
6. ✅ **Validation avant envoi** : oui (validé).
7. ✅ **Paiement** : inclus dans l'abonnement (validé).
8. ✅ **Le moteur historique est-il le système définitif** : oui, c'est le moteur de référence, mais son nom d'origine ne doit pas apparaître dans V2 (validé).
9. ✅ **Le code source est-il disponible localement** : seul le fichier monolithique est disponible ; il servira de référence pour l'adaptateur (validé).
10. ✅ **Le format du QR code** `schoolsafe://student/{matricule}` : conservé tel quel (validé).
11. ✅ **QR signé au scan** (`/{YYYYMMDD}/{sig8}`) : conservé, car le scan crée aussi les listes de présence (validé).
12. ✅ **Patrimoines visuels** : éléments de design de la carte, extraits dans `app/modules/cards/assets/patrimoine/` (validé).
13. ✅ **Transmission** : **push API directe** validé, avec file d'attente locale en cas d'échec.
14. ✅ **Authentification V2 ↔ app centrale** : **HMAC signé avec timestamp** recommandé.
15. ✅ **Durée de validité de l'URL signée R2** : **72 heures** recommandé.
16. ✅ **Gestion des échecs** : retry exponentiel (1 min, 5 min, 15 min), puis `failed` ; notification admin principal ; relance manuelle possible.
17. ✅ **Format de sortie** : **PNG HD** ; deux fichiers séparés `front.png` et `back.png` dans un dossier nommé par école + élève.
18. ✅ **Polices** : **hébergées localement sur le VPS** recommandé.
19. ✅ **Génération de l'image** : dans le **front PWA** avec `html2canvas`. Pas de bouton "Imprimer" dans V2 (validé).

#### Application de contrôle des tokens (toutes répondues / verrouillées)

20. ✅ **Dossier / nom du projet** : `control-app/` à la racine (validé).
21. ✅ **Fonctionnalités minimales pour la première étape** :
    - tableau de bord des demandes d'impression de cartes reçues de chaque VPS école (validé) ;
    - téléchargement des PNG `front.png` + `back.png` depuis R2 (validé) ;
    - bouton "Marquer comme imprimée" pour confirmer le statut (validé) ;
    - génération/révocation des tokens d'instance (validé) ;
    - blocage/déblocage d'une instance (validé).
22. ✅ **Authentification app centrale ↔ VPS école** : clé HMAC signée avec timestamp, échangée hors bande au déploiement (validé).

---

## 6. Travail restant

### Fonctionnalités non terminées

- Gestion du double rôle (enseignant + parent).

### Améliorations prévues

- Tests de contrat pour l'adaptateur cartes.
- Documentation de l'interface du système de cartes.
- Gestion des duplicatas et de l'historique d'impression.

### Options d'intégration à valider

1. **Iframe / lien externe** : garder zalavrai déployé tel quel, y accéder depuis V2 via iframe ou lien. Rapide mais fragmente l'expérience et l'authentification.
2. **Adaptateur front** : embarquer le moteur graphique zalavrai (HTML/CSS/JS) dans V2 et l'alimenter avec les données V2. UX unifiée mais dépend des mêmes contraintes (CDN, html2canvas).
3. **Adaptateur VPS headless** : générer les cartes côté serveur avec le HTML/CSS de zalavrai rendu par Puppeteer/Playwright. Plus fiable mais nécessite un navigateur headless sur le VPS.
4. **Service interne API** : exposer le moteur zalavrai comme un micro-service interne que V2 appelle. Séparation propre mais plus complexe.

La règle `docs/CARDS_IMMUTABILITY.md` exige un **adaptateur versionné avec tests de contrat** quelle que soit l'option choisie.

### Prochaines étapes logiques

1. Gestion du double rôle (enseignant + parent) : union des permissions et des périmètres.
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
- Colonnes ajoutées à `school` et `profiles`.

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

App centrale migrée dans son propre dépôt `https://github.com/medygoo/schoolsafe-control-.git`. Le dossier `control-app/` a été supprimé du dépôt principal. La documentation est en cours de mise à jour.

### Ce que j'étais en train de faire

- Pousser l'historique de `control-app/` vers le dépôt `schoolsafe-control-`.
- Supprimer `control-app/` du dépôt principal.
- Mettre à jour `docs/LAUNCH.md` et `PROJECT-CONTINUITY.md` pour refléter le dépôt séparé.

### Prochaine action

1. Commiter et pousser les mises à jour de documentation sur `origin/main`.
2. Nettoyer les branches temporaires locales (`control-app-split`, `control-app-to-push`).
3. Passer à la gestion du double rôle (enseignant + parent).

### Commandes/tests restants

- `cd server && npm test`
- `node tests/qa-permanent-preview.cjs`
- `cd ../schoolsafe-control- && npm test` (dépôt séparé)
- Ouvrir `http://127.0.0.1:4175/modules/cards/test-card.html` pour validation visuelle.
- Ouvrir `http://127.0.0.1:4175/` pour tester le parcours workspace → Cartes élèves.

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

*Dernière mise à jour : 17 août 2026 — app centrale migrée dans le dépôt dédié `schoolsafe-control-` ; dépôt principal nettoyé et documentation mise à jour.*
