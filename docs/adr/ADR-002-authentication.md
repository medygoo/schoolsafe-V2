# ADR-002 — Authentification SchoolSafe (lot Auth, conception)

- Statut : PROPOSED — aucune implémentation avant validation
- Date : 2026-09-04
- Branche : work/backend-db-reconciliation
- Prérequis prouvés : DB-04C PASS (reprise + from-zero), `api.set_request_context(user, profile, school, request)` opérationnel, schéma `auth` vide réservé dans la baseline

## 1. Contexte et verrous hérités

- La baseline interdit toute dépendance à `auth.uid()` Supabase (vérifié par test statique).
- L'authentification est un lot SÉPARÉ de la migration des données métier (verrou §52).
- Une école = une base PostgreSQL dédiée dans le cluster du VPS (arbitrage C1) : les identités vivent dans la base de l'école, jamais dans Control.
- Control gère instances et licences ; il ne voit jamais un mot de passe.
- R-06 à résoudre : le JWT ne doit plus être lisible par le JavaScript de la page.
- Contraintes terrain RDC : coupures réseau, téléphone comme appareil principal, pas de coût SMS.
- Cloudflare gratuit uniquement ; aucun gros service ajouté.

## 2. Décision

**Fournisseur : authentification maison dans le schéma `auth` de chaque base école.**

- Identifiants : e-mail OU téléphone (le téléphone est résolu en identité côté serveur — mécanisme déjà prouvé dans `server/src/auth`).
- Mots de passe : hachage **argon2id**, jamais en clair, jamais dans les logs.
- Sessions : jeton opaque aléatoire (256 bits) dont seul le **haché** est stocké ; cookie `HttpOnly; Secure; SameSite=Lax` — invisible pour le JavaScript de la page (résout R-06 à la racine).
- Pas de JWT signé côté client pour les sessions ; le JWT reste réservé au jeton de licence Control (autre domaine).

### Alternatives écartées

- **Supabase Auth pour la signature seule** : conserve une dépendance cloud par école, un coût et un point de coupure externe — contraire à l'isolation validée.
- **IdP auto-hébergé (Keycloak/Authentik)** : un service lourd supplémentaire par VPS ; justifié seulement si un SSO multi-écoles émerge un jour (pas le besoin actuel).

## 3. Modèle de données (schéma `auth` de chaque école)

```
auth.identities        : id, user_id (→ iam.users), email unique, phone unique,
                         status (active/disabled), created_at, updated_at
auth.credentials       : identity_id, password_hash (argon2id), algo_version,
                         changed_at, must_change (premier mot de passe temporaire)
auth.sessions          : id, identity_id, token_hash unique, created_at,
                         expires_at, revoked_at, ip, user_agent, request_id création
auth.recovery_requests : identity_id, token_hash, expires_at, used_at,
                         requested_by (profil admin pour le canal de secours)
```

Règles : RLS forcée comme le reste de la baseline ; écriture via fonctions `api.*` uniquement ; audit `audit.events` pour login réussi/échoué/session révoquée.

## 4. Cycle de session

- Durée : 12 h glissantes par défaut (configurable par école), révocation serveur instantanée (`revoked_at`).
- Renouvellement : rotation du jeton à mi-vie (nouveau jeton, ancien révoqué — détection de réutilisation = révocation de la chaîne).
- Hors-ligne PWA : l'interface reste consultable en cache ; toute action réseau sans session valide renvoie 401 — jamais de bascule démo silencieuse (déjà verrouillé dans le frontend).

## 5. Parcours

- **Premier admin** : créé au setup de l'école (token de setup existant), `must_change` forcé à la première connexion.
- **Connexion e-mail** : identité + mot de passe → session.
- **Connexion téléphone** : le téléphone est résolu en identité côté serveur, puis mot de passe (zéro SMS payant).
- **Récupération** : canal administré (un rôle autorisé génère une `recovery_request` à usage unique, 30 min) + e-mail Brevo si configuré.
- **MFA** : TOTP optionnel en phase 2 (pas requis au lancement).
- **Révocation** : admin ou utilisateur ; effet immédiat.

## 6. Intégration backend (le pont avec la baseline)

```
cookie de session
  → middleware Fastify : valide session (haché, expiration, révocation)
  → résout user_id + profile_id actif + school_id (depuis la base de l'école)
  → ouvre une transaction PostgreSQL
  → api.set_request_context(user, profile, school, request_id)
  → n'appelle QUE les fonctions api.* (rôle schoolsafe_api, aucun accès table direct)
  → audit si action sensible
```

Le navigateur ne fournit jamais user_id/profile_id/school_id (verrou existant).

## 7. Migration des identités historiques (lot séparé, après capture de l'état Cloud)

- Les mots de passe Supabase ne sont pas migrables (hachés bcrypt propriétaire) → **réinitialisation contrôlée** : chaque utilisateur reçoit une récupération à première connexion, avec audit.
- Jamais mélangé avec l'import des données métier (verrou §52).

## 8. Tests obligatoires (avant implémentation — TDD)

- Mot de passe faux → refus + audit ; compte désactivé → refus.
- Session expirée / révoquée / token rejoué → 401.
- Téléphone inconnu → réponse identique à mot de passe faux (pas d'énumération).
- Contexte incohérent (profil d'une autre école) → refus fail-closed.
- Rate limiting : 5 échecs → verrouillage 15 min (configurable).
- Concurrent login/logout → aucune session zombie.

## 9. Preuves de sortie du lot d'implémentation (AUTH-CORE)

- Tests serveur : tout le §8 vert.
- Démonstration : login e-mail + téléphone sur instance TEST, action métier via RPC `api.*` avec contexte injecté, révocation visible immédiatement.
- Vérification : aucun token dans localStorage/sessionStorage (contrôle navigateur).

## 10. Ce que ce lot ne fait PAS

- Pas de SMS/OTP payant. Pas de MFA obligatoire. Pas de SSO. Pas de migration des données métier. Pas de modification du frontend au-delà du branchement de la session.
