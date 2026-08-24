# Fiche de lancement — SchoolSafe V2

Ce document explique comment démarrer SchoolSafe V2 en local pour le développement, puis comment déployer l'application en production.

---

## 1. Vue d'ensemble

SchoolSafe V2 est composé de trois blocs :

| Bloc | Dossier | Rôle | Hébergement typique |
|------|---------|------|---------------------|
| **Front PWA** | `app/` | Interface école (configuration, cartes, workspace) | VPS école (fichiers statiques) |
| **API école** | `server/` | API Fastify du VPS école | VPS école (Node.js) |
| **App centrale** | dépôt [`schoolsafe-control-`](https://github.com/medygoo/schoolsafe-control-) | Contrôle des tokens et impression des cartes | Render.com + Neon |

Chaque école a **son propre VPS** et **sa propre base Supabase**. L'application reste identique ; seules les variables d'environnement changent.

---

## 2. Prérequis

- **Node.js** ≥ 22 ([https://nodejs.org](https://nodejs.org))
- **npm** (fourni avec Node.js)
- **Supabase CLI** ([https://supabase.com/docs/guides/cli](https://supabase.com/docs/guides/cli))
- **Git**
- Un compte **Render.com** et **Neon.tech** pour l'app centrale (gratuit)
- Un compte **Cloudflare R2** pour le stockage des fichiers lourds (optionnel en local)
- Un compte **Brevo** pour l'envoi d'e-mails (optionnel en local)

---

## 3. Lancer l'application en local

### 3.1 Cloner le dépôt

```bash
git clone https://github.com/medygoo/schoolsafemm.git
cd schoolsafemm
```

### 3.2 Démarrer Supabase en local

```bash
npx supabase start
```

Cela démarre :

- l'API Supabase sur `http://127.0.0.1:54321`
- la base PostgreSQL sur `127.0.0.1:54322`

Appliquer les migrations et le seed :

```bash
npx supabase db reset
```

Pour mettre à jour une base existante avec les dernières migrations sans perdre les données :

```bash
npx supabase migration up
```

Les migrations du projet se trouvent dans `supabase/migrations/`.

### 3.3 Configurer l'API école (`server/`)

```bash
cd server
cp ../.env.example .env
npm install
```

Éditer `server/.env` :

```env
NODE_ENV=development
HOST=127.0.0.1
PORT=8787
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<clé anon locale>
SUPABASE_SERVICE_ROLE_KEY=<clé service_role locale>
SETUP_TOKEN=setup-token-local-2026
```

> Les clés Supabase locales s'affichent après `npx supabase start`.

Variables optionnelles pour les cartes et l'app centrale :

```env
R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_CARDS=cards
CONTROL_APP_URL=http://127.0.0.1:4176
CONTROL_APP_INSTANCE_ID=...
CONTROL_APP_HMAC_SECRET=...
```

Démarrer l'API :

```bash
npm run dev
```

L'API est disponible sur `http://127.0.0.1:8787`.

### 3.4 Construire le SDK d'authentification pour le front

Depuis la racine du projet :

```bash
npm install
npm run build:auth-sdk
```

Cela génère `app/vendor/supabase-sdk.js` utilisé par le front PWA.

### 3.5 Servir le front PWA

```bash
cd app
node server.mjs
```

Le front est accessible sur `http://127.0.0.1:4175`.

Pour tester le studio de cartes, ouvrir :

```
http://127.0.0.1:4175/modules/cards/test-card.html
```

### 3.6 Lancer l'app centrale en local

L'app centrale est dans un dépôt séparé :

```bash
git clone https://github.com/medygoo/schoolsafe-control-.git
cd schoolsafe-control-
npm install
```

Créer un fichier `.env` :

```env
HOST=127.0.0.1
PORT=4176
ADMIN_TOKEN=ss-admin-token-local-2026-secure
```

Sans `DATABASE_URL`, l'app centrale utilise automatiquement SQLite dans `./data/control-app.db`.

Démarrer :

```bash
npm run dev
```

Le tableau de bord est accessible sur `http://127.0.0.1:4176`.

---

## 4. Première configuration d'une école

1. Ouvrir le front PWA : `http://127.0.0.1:4175`.
2. Saisir le **token de setup** (`SETUP_TOKEN` configuré côté serveur).
3. Remplir les 7 étapes de configuration de l'école :
   - identité (nom FR / EN, slogan, site, contacts) ;
   - cycles et année scolaire ;
   - coordonnées ;
   - logo et couleurs ;
   - création du compte administrateur principal.
4. Se connecter avec l'administrateur créé.
5. Le workspace s'affiche avec les modules disponibles.

---

## 5. Déployer l'app centrale (Render + Neon)

L'app centrale a son propre dépôt : https://github.com/medygoo/schoolsafe-control-

Suivre le guide détaillé : [`DEPLOY.md`](https://github.com/medygoo/schoolsafe-control-/blob/main/DEPLOY.md).

Résumé :

1. Créer une base PostgreSQL sur **Neon** (`schoolsafe_control`).
2. Créer un **Web Service** sur Render à partir du dépôt `medygoo/schoolsafe-control-`.
3. Laisser le répertoire racine vide (le `Dockerfile` est à la racine du dépôt).
4. Ajouter les variables d'environnement :
   - `DATABASE_URL` (URL Neon)
   - `ADMIN_TOKEN` (token fort d'au moins 16 caractères)
5. Render détecte le `Dockerfile` et déploie automatiquement.
6. Noter l'URL Render (ex. `https://schoolsafe-control-app.onrender.com`).

---

## 6. Connecter une école à l'app centrale

Dans l'app centrale :

1. Se connecter avec le `ADMIN_TOKEN`.
2. Créer une instance pour l'école.
3. Récupérer :
   - `setup_token`
   - `hmac_secret`
   - `instance_id`

Dans les variables d'environnement du VPS de l'école (`server/.env`) :

```env
SETUP_TOKEN=<setup_token>
CONTROL_APP_URL=https://schoolsafe-control-app.onrender.com
CONTROL_APP_INSTANCE_ID=<instance_id>
CONTROL_APP_HMAC_SECRET=<hmac_secret>
```

Redémarrer l'API école.

---

## 7. Vérifier que tout fonctionne

### Tests automatiques

```bash
# API école
cd server && npm test

# App centrale (dépôt séparé)
cd ../schoolsafe-control- && npm test

# Vérification du bundle auth-sdk
npm run check:auth-sdk

# Tests RLS
npm run test:rls

# Preview PWA permanente
node tests/qa-permanent-preview.cjs
```

### Vérifications manuelles

- [ ] Le front PWA s'ouvre sur `http://127.0.0.1:4175`.
- [ ] Le token de setup est accepté.
- [ ] L'école peut être configurée sur les 7 étapes.
- [ ] L'administrateur peut se connecter.
- [ ] Le workspace affiche les modules **Cartes élèves**, **Pédagogie**, **Finance**, **Sécurité QR**, **Pilotage**.
- [ ] Le studio de cartes génère un aperçu recto/verso.
- [ ] La demande d'impression arrive dans l'app centrale.
- [ ] L'opérateur peut télécharger les PNG et marquer la demande comme imprimée.
- [ ] Les paiements et reçus fonctionnent dans le module Finance.
- [ ] Les devoirs, cotes et moyennes fonctionnent dans le module Pédagogie.
- [ ] Le scan QR et le lockdown fonctionnent dans le module Sécurité.
- [ ] Les alertes, approbations et snapshots fonctionnent dans le module Pilotage.
- [ ] Les notifications push s’enregistrent côté navigateur.

---

## 8. Référence des variables d'environnement

### `server/.env`

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `NODE_ENV` | oui | `development`, `test`, `staging` ou `production` |
| `HOST` | oui | Interface d'écoute (défaut : `127.0.0.1`) |
| `PORT` | oui | Port d'écoute (défaut : `8787`) |
| `SUPABASE_URL` | oui | URL de l'instance Supabase |
| `SUPABASE_ANON_KEY` | oui | Clé publique Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | non | Clé service role (nécessaire pour les cartes) |
| `SETUP_TOKEN` | non | Token de première configuration de l'école |
| `R2_ENDPOINT` | non | Endpoint Cloudflare R2 |
| `R2_ACCESS_KEY_ID` | non | Clé d'accès R2 |
| `R2_SECRET_ACCESS_KEY` | non | Secret d'accès R2 |
| `R2_BUCKET_CARDS` | non | Bucket R2 pour les cartes (défaut : `cards`) |
| `CONTROL_APP_URL` | non | URL de l'app centrale |
| `CONTROL_APP_INSTANCE_ID` | non | ID de l'instance dans l'app centrale |
| `CONTROL_APP_HMAC_SECRET` | non | Secret HMAC pour signer les appels à l'app centrale |
| `VAPID_PRIVATE_KEY` | non | Clé privée VAPID pour les notifications push |
| `VAPID_PUBLIC_KEY` | non | Clé publique VAPID (fournie au front) |
| `VAPID_SUBJECT` | non | Sujet VAPID (`mailto:` ou URL) |
| `BREVO_API_KEY` | non | Clé API Brevo pour les e-mails transactionnels |
| `BREVO_SENDER_EMAIL` | non | Adresse d’envoi Brevo |
| `CARD_HMAC_SECRET` | non | Secret pour signer les QR codes des cartes |
| `DEFAULT_STAFF_PASSWORD` | non | Mot de passe temporaire des nouveaux membres du personnel |

### `schoolsafe-control-/.env`

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `HOST` | oui | Interface d'écoute (défaut : `127.0.0.1`) |
| `PORT` | oui | Port d'écoute (défaut : `4176`) |
| `ADMIN_TOKEN` | oui | Token d'accès au tableau de bord (≥ 16 caractères) |
| `DATABASE_URL` | non | URL PostgreSQL (Neon). Si absent, SQLite est utilisé. |
| `DATA_DIR` | non | Dossier SQLite en local (défaut : `./data`) |

---

## 9. Résolution des problèmes courants

### `EADDRINUSE` au démarrage

Un ancien processus utilise déjà le port. Sous Windows avec Git Bash :

```bash
netstat -ano | grep :4175
# ou :4176, :8787
taskkill /PID <PID> /F
```

### Le front ne trouve pas `supabase-sdk.js`

Relancer `npm run build:auth-sdk` depuis la racine.

### L'app centrale ne reçoit pas les demandes d'impression

- Vérifier `CONTROL_APP_URL`, `CONTROL_APP_INSTANCE_ID` et `CONTROL_APP_HMAC_SECRET` côté VPS.
- Vérifier que l'instance n'est pas bloquée dans l'app centrale.
- Vérifier l'horloge du VPS : un décalage supérieur à 5 minutes invalide la signature HMAC.

### Render met le service en veille

Le plan gratuit Render arrête le service après 15 minutes d'inactivité. La première requête réveille le service en 30–60 secondes.

---

## 10. Prochaines étapes après le lancement

1. Créer les comptes utilisateurs (enseignants, parents, personnel).
2. Configurer les rôles et permissions.
3. Renseigner les classes et les élèves.
4. Tester la production de cartes élèves de bout en bout.
5. Déployer le front PWA et l'API école sur le VPS de l'école.

Pour la suite du développement, consulter [`PROJECT-CONTINUITY.md`](../PROJECT-CONTINUITY.md).
