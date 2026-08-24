> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:writing-plans` after this design is approved to produce the implementation plan.

# SchoolSafe V2 — Design global : architecture Cloudflare + UI/UX

**Date :** 2026-08-18  
**Statut :** Approved — validé le 2026-08-18  
**Sources :** `PRODUCT.md`, `docs/V2_CHARTER.md`, `docs/FUNCTIONAL_CATALOG.md`, `docs/DESIGN_SYSTEM.md`, `docs/VISUAL_PATRIMONY.md`, `docs/CARDS_IMMUTABILITY.md`, `docs/POSTGRESQL_AUDIT.md`, `docs/OFFLINE_SYNC_CONTRACT.md`

## 1. Objectif et périmètre

Ce document définit la cible technique et visuelle de SchoolSafe V2 :

- Héberger le frontend sur **Cloudflare Pages / Workers Assets**.
- Porter le backend de **Fastify/Node.js** vers **Cloudflare Workers** (Hono).
- Connecter la base de données et l’auth à **Supabase Cloud Free** (projet `SCHOOLSAFE-FIN`).
- Utiliser **Cloudflare R2, D1, KV, Queues, Workflows, Cron, Images, Secrets Store, WAF, Turnstile, Zero Trust** selon les besoins.
- Conserver le patrimoine visuel : écran bleu, logo, portraits d’enfants, cube 3D, slogan.
- Moderniser et compléter les modules métier : École/Personnel, Finance, Pédagogie, Sécurité QR, Pilotage, Notifications.

## 2. Vue d’ensemble de l’architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Utilisateur (navigateur)                    │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ HTTPS
┌──────────────────────────────────▼──────────────────────────────────┐
│  Cloudflare DNS + CDN + WAF + DDoS + Rate Limiting + Turnstile      │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                                         │
┌─────────────▼─────────────┐               ┌───────────▼────────────┐
│  Frontend                 │               │  API backend           │
│  Cloudflare Pages         │               │  Cloudflare Workers    │
│  (Workers Assets)         │               │  (Hono)                │
│  • PWA statique           │               │  • Auth JWT Supabase   │
│  • Aucun secret           │               │  • Permissions RLS/RPC │
│  • Reçoit config publique │◄──────────────│  • Métiers + async     │
│    via /config            │   fetch API   │  • Notifications       │
└───────────────────────────┘               └───────────┬────────────┘
                                                        │
                              ┌─────────────────────────┼─────────────────────────┐
                              │                         │                         │
                   ┌──────────▼──────────┐  ┌───────────▼──────────┐  ┌───────────▼──────────┐
                   │ Supabase Cloud Free │  │ Cloudflare R2        │  │ Cloudflare D1        │
                   │ PostgreSQL + Auth   │  │ Photos, PDF,         │  │ Archives historiques │
                   │ JWT + RLS           │  │ bulletins, reçus,    │  │ (scans, événements)  │
                   │                     │  │ backups              │  │                      │
                   └─────────────────────┘  └──────────────────────┘  └──────────────────────┘
                              │
                   ┌──────────▼──────────┐
                   │ Cloudflare KV       │
                   │ cache, config       │
                   │ temporaire          │
                   └─────────────────────┘

Traitements asynchrones :
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Cloudflare      │───►│ Cloudflare      │───►│ Brevo / SMS /   │
│ Queues          │    │ Workflows       │    │ Web Push        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        ▲                       ▲
        └───────────┬───────────┘
                    │
           Cloudflare Cron Triggers
           (archivage, nettoyage, backups)
```

## 3. Frontend — Cloudflare Pages / Workers Assets

### 3.1 Hébergement

- Le dossier `app/` est déployé sur **Cloudflare Pages**.
- Déclencheur : `git push` sur `main` → workflow GitHub Actions → `wrangler pages deploy`.
- Le workflow GitHub Pages actuel (`.github/workflows/static.yml`) sera remplacé ou complété par un workflow Wrangler.
- Le frontend est **statique** : HTML, CSS, JS vanilla, PWA.

### 3.2 Configuration publique

- Le frontend ne contient **aucun secret**.
- Au démarrage, il appelle `GET /config` sur l’API Workers pour récupérer :
  - `supabase_url`
  - `supabase_anon_key`
  - `api_base` (URL publique de l’API)
- Ces valeurs sont ensuite utilisées pour créer le client Supabase et les appels API.
- L’URL de l’API est déterminée par le domaine Cloudflare (ex. `https://api.schoolsafe.example.com`) ou par une variable d’environnement au build.

### 3.3 Patrimoine visuel (verrouillé)

Éléments conservés à l’identique (cf. `docs/VISUAL_PATRIMONY.md`) :

- Splash bleu (`#071a3d`), particules multicolores, textes historiques.
- Logo SchoolSafe, lignes multicolores.
- Écran des portraits d’enfants, animation calibrée, rotation des photos.
- Formulaire de connexion transparent sur photo.
- Accès e-mail et téléphone séparés.
- Slogan « Chaque enfant protégé, chaque parent informé ».
- Cube 3D animé dans la barre supérieure du workspace.
- Volet latéral bleu profond, bandeau de synthèse bleu, tuiles colorées par domaine.

### 3.4 Structure du workspace

Le workspace actuel (`#workspace`) reste structuré autour :

- **Volet latéral** : navigation par profil, visible sur desktop, replié derrière le cube sur mobile.
- **Barre supérieure** : cube 3D (menu), titre de l’écran, indicateurs hors-ligne/sync, profil actif.
- **Surface centrale** : groupements métier par tuiles colorées.
- **Panneau de périmètre** : rôle, année scolaire active, portée des données.

### 3.5 Modules métier à concevoir / compléter

| Module | État actuel | Travail restant |
|---|---|---|
| **Auth & setup** | Existe | Finaliser flux OTP, récupération, secours admin. |
| **École & Personnel** | Partie B livrée | Affiner UX invitation, rôles, activation. |
| **Finance** | Backend partiel, frontend démo | Connecter au backend : paiements, soldes, reçus, clôture caisse. |
| **Pédagogie** | Phase 1 | Publication devoirs/cotes, vue parent, moteur de moyennes, bulletins. |
| **Sécurité QR** | Backend partiel, frontend minimal | Scanner QR, affichage gardien, lockdown, historique. |
| **Pilotage** | Alertes + dashboard basiques | Moteur d’alertes avancé, approbations, snapshots tendances. |
| **Notifications** | Types/providers créés | Dispatcher connecté aux événements, templates par défaut. |
| **Cartes** | Sous-système protégé | Adaptateur de connexion uniquement, pas de réimplémentation. |

Chaque nouveau module respecte le langage visuel existant : tuiles par domaine, formulaires denses, tableaux administratifs, modales d’action.

### 3.6 Safe — Assistante virtuelle SchoolSafe

Safe est l’assistante conversationnelle et guide de l’interface SchoolSafe. Elle est intégrée au workspace et disponible sur tous les écrans.

**Rôles :**
- Guide contextuel : explique l’écran actuel et met en évidence les actions possibles (mode « Montre-moi »).
- FAQ interactive : répond aux questions sur l’utilisation de SchoolSafe.
- Feedback visuel : réagit aux événements applicatifs (succès, erreur, chargement, alerte).

**Comportement :**
- Visible par défaut en bas à droite du workspace (desktop) ou centré en bas (mobile).
- Taille : 240 × 360 px sur desktop, 140 × 210 px sur mobile.
- Bulle de dialogue centrée au-dessus de sa tête, adaptative (max-width 320 px desktop, 280 px mobile), scroll si le message dépasse 6 lignes.
- Bouton × dans la bulle pour la fermer.
- Bouton flottant 🎒 pour rappeler Safe quand elle est réduite.
- 12 poses contextuelles : accueil, salut, pointe, réflexion, pouce, saute, sourire, inquiet, concentré, félicitations, explique, écoute.

**Mode « Montre-moi » :**
- Safe se déplace vers l’élément à expliquer.
- Overlay assombri avec un trou lumineux sur l’élément cible.
- Bulle au-dessus de sa tête décrit l’action.
- Séquence d’étapes navigables.

**Backend V1 (MVP) :**
- Réponses prédéfinies par intention (FAQ statique).
- Endpoint `POST /safe/ask` qui renvoie la réponse et la pose associée.

**Backend V2 (futur) :**
- Workers AI + Vectorize pour un RAG sur la documentation SchoolSafe.
- Same-pose et réactions contextuelles enrichies.

## 4. Backend — Cloudflare Workers (Hono)

### 4.1 Framework et structure

- **Framework** : [Hono](https://hono.dev) (léger, typé, middlewares, compatible Workers).
- **Structure** :

```
workers/
├── src/
│   ├── index.ts              # entrypoint fetch, CORS, routing
│   ├── env.ts                # types bindings + validation Zod
│   ├── lib/
│   │   ├── errors.ts         # SchoolSafeError
│   │   ├── request-id.ts     # crypto.randomUUID()
│   │   ├── crypto.ts         # HMAC, hash (Web Crypto)
│   │   ├── supabase.ts       # clients anon + service_role
│   │   ├── r2.ts             # client R2 léger (S3 fetch)
│   │   ├── multipart.ts      # parser multipart
│   │   └── webpush.ts        # VAPID + chiffrement ECE
│   ├── middleware/
│   │   ├── auth.ts           # extraction Bearer + vérification
│   │   ├── permission.ts     # requirePermission / requireScope
│   │   ├── cors.ts           # CORS domaine frontend
│   │   └── error.ts          # format réponse erreur
│   ├── routes/
│   │   ├── setup.ts
│   │   ├── bootstrap.ts
│   │   ├── school.ts
│   │   ├── cards.ts
│   │   ├── security.ts
│   │   ├── finance.ts
│   │   ├── pedagogy.ts
│   │   ├── pilotage.ts
│   │   ├── email.ts
│   │   └── push.ts
│   └── services/
│       ├── setup.ts
│       ├── bootstrap.ts
│       ├── school.ts
│       ├── cards.ts
│       ├── security.ts
│       ├── finance.ts
│       ├── pedagogy.ts
│       ├── pilotage.ts
│       ├── events.ts
│       └── notifications/
│           ├── dispatcher.ts
│           ├── service.ts
│           ├── subscriptions.ts
│           └── providers/
│               ├── brevo.ts
│               ├── zoho.ts
│               ├── in-app.ts
│               └── push.ts
├── tests/
│   └── (unit + integration Miniflare/Workers)
├── wrangler.toml
├── package.json
└── tsconfig.json
```

### 4.2 Authentification

- Le frontend envoie le JWT Supabase dans `Authorization: Bearer <token>`.
- Le Workers vérifie le token via `client.auth.getUser(token)` (client Supabase anon).
- Pour les appels en contexte utilisateur (RLS), on reconstruit un client Supabase avec le Bearer.
- Le `service_role_key` est stocké dans **Wrangler Secrets** et utilisé uniquement côté serveur.

### 4.3 Permissions

- Middleware `requirePermission(permission)` et `requireScope(scope)`.
- Vérification via RPC Supabase `has_permission` / `has_scope`.
- Refus explicite l’emporte (`deny override`).

### 4.4 Routes à porter depuis Fastify

Reprise 1-for-1 des endpoints existants (cf. cartographie backend) :

- `/health`, `/ready`
- `/config`, `/setup/*`, `/auth/lookup-phone`
- `/session/bootstrap`
- `/school/*`
- `/cards/request-print`
- `/security/scan`, `/security/lockdown`, `/security/events`
- `/finance/*`
- `/pedagogy/*`
- `/pilotage/*`
- `/email/send`
- `/push/subscribe`
- `/safe/ask` (V1 : FAQ statique ; V2 : RAG Workers AI)

### 4.5 Réécritures techniques

| Élément Fastify | Équivalent Workers |
|---|---|
| Fastify router | Hono router |
| `@fastify/multipart` | Parser multipart maison ou lib edge-compatible |
| `@fastify/static` | R2 / Workers Assets |
| `node:crypto.createHmac` | Web Crypto `HMAC` |
| `node:crypto.randomUUID` | `crypto.randomUUID()` |
| `Buffer.from(base64)` | `Uint8Array` + `atob` |
| `@aws-sdk/client-s3` | API S3 fetch signée (`aws4fetch` ou maison) |
| `web-push` | Implémentation Web Push API + Web Crypto |
| `process.env` | Bindings `env` Cloudflare |

## 5. Couche de données

### 5.1 Supabase PostgreSQL (source de vérité)

- Projet **SCHOOLSAFE-FIN** (Cloud Free).
- Les 16 migrations actuelles sont poussées via `supabase db push` après création du projet.
- Avant application, vérifier l’état de la base distante pour éviter tout écrasement de données.
- Auth, RLS, RPC, triggers, audit : inchangés.

### 5.2 Cloudflare R2 (fichiers)

- Photos de cartes, logos d’école, PDF de reçus/bulletins, documents, archives, backups PostgreSQL.
- Client léger utilisant l’API S3 compatible.
- Aucun fichier écrit sur filesystem local.

### 5.3 Cloudflare D1 (archives consultables)

- Historique des scans QR anciens.
- Anciens événements système.
- Données archivées depuis Supabase via Cron.
- Lecture seule pour l’utilisateur ; écriture par Workers/Cron.

### 5.4 Cloudflare KV (cache & config)

- Cache de permissions/rôles (TTL court).
- Configuration légère publique ou temporaire.
- Paramètres de feature flags si nécessaire.

## 6. Traitements asynchrones

### 6.1 Cloudflare Queues

- File d’attente pour notifications emails, SMS, in-app.
- Désacouplement des modules métier (sécurité, finance, pédagogie) de l’envoi.

### 6.2 Cloudflare Workflows

- Processus multi-étapes :
  - Génération de reçu PDF → envoi email → archivage.
  - Paiement enregistré → mise à jour solde → notification parents → alerte si impayé.
  - Scan QR → vérification → log → notification → alerte si anomalie.

### 6.3 Cloudflare Cron Triggers

- Archivage Supabase → D1/R2.
- Nettoyage des données temporaires.
- Sauvegardes PostgreSQL vers R2.
- Synchronisation des snapshots d’indicateurs.

## 7. Notifications

| Canal | Technologie |
|---|---|
| In-app | INSERT dans `notifications` (Supabase) |
| Email | Brevo API (`fetch`) ; Zoho Mail avec fallback Brevo |
| SMS | Fournisseur SMS via Queues (futur) |
| Push | Web Push VAPID + Web Crypto |

- Templates stockés dans `notification_templates` (Supabase).
- Dispatcher lit les `system_events`, charge le template, résout les tuteurs, crée les notifications.
- Le `NotificationService` orchestre les providers et persiste le résultat.

## 8. Sécurité

### 8.1 Secrets

Toutes les clés sensibles sont dans **Wrangler Secrets** et/ou **Cloudflare Secrets Store** :

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `BREVO_API_KEY`
- `ZOHO_MAIL_API_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `CARD_HMAC_SECRET`
- `CONTROL_APP_HMAC_SECRET`
- `SETUP_TOKEN`

Aucun secret n’est commité. Le CI existant vérifie déjà l’absence de clés privées dans Git.

### 8.2 Protection réseau

- **Cloudflare WAF** : règles de base + personnalisées.
- **Rate Limiting** : protection login, setup, scan QR.
- **Turnstile** : protection des formulaires publics (login, setup).
- **DDoS Protection** : actif par défaut.
- **Zero Trust / Access** : protection des accès administratifs au dashboard/studio.

### 8.3 CORS

- Le backend n’accepte les requêtes que depuis le domaine frontend autorisé.
- Configuration dynamique via binding `ALLOWED_ORIGINS`.

## 9. Migration par phases

| Phase | Objectif | Livrable |
|---|---|---|
| **Phase 0** | Créer projet Supabase SCHOOLSAFE-FIN ; configurer compte Cloudflare (Workers, Pages, R2, D1, KV) | Projets prêts |
| **Phase 1** | Squelette Workers + fondations | `/health`, `/ready`, `/config`, `/session/bootstrap`, `/setup/*` |
| **Phase 2** | Modules CRUD simples | `school`, `pedagogy`, `finance`, `pilotage` |
| **Phase 3** | Sécurité QR + cartes | `/security/scan`, `/cards/request-print`, R2, HMAC |
| **Phase 4** | Notifications complètes | Events, dispatcher, Brevo, push Web Crypto |
| **Phase 5** | Upload multipart + archivage | Logo R2, D1, Cron |
| **Phase 6** | Tests edge, monitoring, bascule DNS | Production sur Cloudflare Pages + Workers |

## 10. Déploiement et CI/CD

### 10.1 Frontend

- Workflow GitHub Actions sur `push` vers `main` :
  - Build éventuel du SDK Supabase (`npm run build:auth-sdk`).
  - `wrangler pages deploy ./app --project-name schoolsafe-v2`.

### 10.2 Backend

- Workflow GitHub Actions sur `push` vers `main` :
  - `npm run typecheck`.
  - `npm run test` (Vitest + pool Workers).
  - `wrangler deploy`.
- Secrets Wrangler gérés via CLI ou dashboard Cloudflare, **jamais via GitHub**.

### 10.3 Supabase

- Migrations appliquées manuellement ou via CI dédiée avec `supabase db push`.
- Aucune migration automatique sans backup préalable sur la base de production.

## 11. Tests

- **Unitaires** : Vitest avec `@cloudflare/vitest-pool-workers`.
- **RLS** : continuer les tests de contrats RLS sur base locale.
- **QA navigateur** : Playwright sur la PWA déployée.
- **Smoke** : endpoints `/health`, `/ready`, `/config`.

## 12. Monitoring et quotas

- **Cloudflare Web Analytics** : trafic frontend.
- **Workers Analytics** : requêtes, erreurs, cold starts.
- **Supabase Dashboard** : usage DB, auth, storage.
- **Alertes quotas** : Supabase, R2, Workers, Queues, D1, KV, Brevo.

## 13. Risques et décisions ouvertes

| Risque | Mitigation |
|---|---|
| Taille du bundle Workers | Remplacer AWS SDK par client R2 léger ; tester bundle. |
| `web-push` incompatible | Réécrire avec Web Push API + Web Crypto. |
| Cold starts Supabase | Cacher permissions/rôles dans KV avec TTL court. |
| Migrations sur base existante | Backup avant push ; vérifier conflits. |
| CORS/domaine | Configurer binding `ALLOWED_ORIGINS`. |

---

**Décisions à valider par le propriétaire :**

1. Validation de l’architecture Cloudflare Workers + Supabase.
2. Approbation de la migration par phases.
3. Approbation du `PRODUCT.md` rédigé.
4. Création du projet Supabase SCHOOLSAFE-FIN et mise à disposition des clés (de manière sécurisée).
5. Configuration du compte Cloudflare (Workers, Pages, R2, D1, KV, domaine).
