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
- **Mode de transmission** : **push API directe** validé. V2 appelle l'app centrale dès qu'une carte est prête, avec clé API et file d'attente locale en cas d'échec.
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

**Conception technique de l'adaptateur de génération de cartes dans SchoolSafe V2** : schéma de données, API V2, API app centrale, module de génération d'image.

### État d'avancement

- Fichier complet téléchargé localement : `analysis/zalavrai.html` (~2,2 Mo).
- Analyse technique complète réalisée (section détaillée ci-dessous).
- Architecture des cartes verrouillée :
  - V2 génère la carte finie (PNG/PDF).
  - V2 n'a pas de bouton "Imprimer" ; seul "Demander l'impression" existe.
  - Stockage dans R2 (bucket privé `cards/`).
  - L'app centrale télécharge via URL signée et imprime.
  - Validation obligatoire avant envoi.
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
- **La création de cartes est déjà fonctionnelle et terminée dans zalavrai** ; il ne s'agit pas de la réinventer, mais de la brancher proprement dans V2.
- **V2 possède déjà deux systèmes de scan** :
  - scan pour contrôle de frais ;
  - scan pour contrôle d'arrivée et de sortie de classe.
- **Décision d'architecture prise** : la production physique (téléchargement + impression) se fait dans l'**application de contrôle des tokens**. SchoolSafe V2 prépare et transmet la demande.
- Mode de transmission validé : **push API directe** avec clé API et file d'attente locale.
- **En cours de conception** : schéma `card_print_requests`, endpoints API, module d'adaptateur de génération.
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

- Le système zalavrai est autosuffisant et contient tout le moteur graphique.
- `docs/CARDS_IMMUTABILITY.md` interdit formellement de réimplémenter ce moteur.
- Plusieurs options d'intégration sont possibles ; aucune n'a encore été choisie par le propriétaire.

### Questions en attente de réponse du propriétaire

1. ✅ **Emplacement de la production de cartes** : dans l'**application de contrôle des tokens** (validé).
2. ✅ **Qui produit physiquement** : l'app de contrôle des tokens télécharge et imprime (validé).
3. ✅ **Contenu de la demande** : V2 génère la **carte finie** (image/PDF) et l'envoie à l'app centrale (validé).
4. ✅ **Stockage intermédiaire** : la carte transite par **R2** dans un bucket privé ; V2 génère des URLs signées pour l'app centrale (validé).
5. ✅ **Qui déclenche la demande dans V2** : l'**admin principal** ou la personne à qui il a donné accès (validé).
6. ✅ **Validation avant envoi** : oui (validé).
7. ✅ **Paiement** : inclus dans l'abonnement (validé).
8. ✅ **zalavrai est-il le système définitif** : oui, c'est le moteur de référence, mais le nom "zalavrai" ne doit pas apparaître dans V2 (validé).
9. ✅ **Le code source est-il disponible localement** : seul le fichier monolithique est disponible ; il servira de référence pour l'adaptateur (validé).
10. ✅ **Le format du QR code** `schoolsafe://student/{matricule}` : conservé tel quel (validé).
11. ✅ **QR signé au scan** (`/{YYYYMMDD}/{sig8}`) : conservé, car le scan crée aussi les listes de présence (validé).
12. ✅ **Patrimoines visuels** : éléments de design de la carte, à extraire du fichier de référence pour l'adaptateur (validé).
13. ✅ **Transmission** : **push API directe** validé, avec clé API et file d'attente locale en cas d'échec.
14. **Authentification V2 ↔ app centrale** : clé API simple, JWT, ou HMAC signé ?
15. **Durée de validité de l'URL signée R2** : 24 heures, 72 heures, 7 jours ?
16. **Gestion des échecs** : combien de tentatives avant marquage `failed` ? Notification à qui ?
17. **Format de sortie** : PNG recto+verso combiné, ou deux fichiers séparés (recto.png + verso.png) ?

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

### Options d'intégration à valider

1. **Iframe / lien externe** : garder zalavrai déployé tel quel, y accéder depuis V2 via iframe ou lien. Rapide mais fragmente l'expérience et l'authentification.
2. **Adaptateur front** : embarquer le moteur graphique zalavrai (HTML/CSS/JS) dans V2 et l'alimenter avec les données V2. UX unifiée mais dépend des mêmes contraintes (CDN, html2canvas).
3. **Adaptateur VPS headless** : générer les cartes côté serveur avec le HTML/CSS de zalavrai rendu par Puppeteer/Playwright. Plus fiable mais nécessite un navigateur headless sur le VPS.
4. **Service interne API** : exposer le moteur zalavrai comme un micro-service interne que V2 appelle. Séparation propre mais plus complexe.

La règle `docs/CARDS_IMMUTABILITY.md` exige un **adaptateur versionné avec tests de contrat** quelle que soit l'option choisie.

### Prochaines étapes logiques

1. Clarifier si V2 envoie l'image/PDF généré ou seulement les données brutes.
2. Choisir le canal de transmission entre V2 et l'app centrale.
3. Choisir le stockage intermédiaire (R2, Supabase Storage, génération à la volée).
4. Choisir l'option technique d'intégration du moteur graphique (front, VPS headless, iframe, service interne).
5. Documenter l'interface d'entrée/sortie du système de cartes.
6. Créer l'adaptateur versionné.
7. Capturer des exemples de référence et écrire les tests de contrat.
8. Passer à l'application de contrôle centrale.

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

Mode de transmission **push API directe** validé. Toutes les décisions métier sur les cartes sont verrouillées. Passage à la conception technique de l'adaptateur.

### Ce que j'étais en train de faire

- Documenter la validation du push API dans `PROJECT-CONTINUITY.md`.
- Préparer la conception technique de l'adaptateur.

### Prochaine action

1. Commiter la mise à jour de `PROJECT-CONTINUITY.md`.
2. Présenter la conception technique complète (schéma, API, module).
3. Valider avec le propriétaire avant d'écrire le moindre code.

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

*Dernière mise à jour : 16 août 2026 — après validation du push API directe, passage à la conception technique.*
