# ADR-001 — Lignée de données et couche API de SchoolSafe V2

- Statut : PROPOSED (points 1-3, 5) · PROVISIONAL (point 2, en attente du spike)
- Date : 2026-09-03
- Branche : work/backend-db-reconciliation @ 9ba0bb5

## Contexte

Deux backends coexistent, tous deux couplés à Supabase (server/ Fastify 7 482 lignes,
15 domaines, 177 cas de test ; workers/ Hono 1 032 lignes, 6 domaines, 9 cas de test,
paiement non atomique workers/src/services/finance.ts:32-63). La baseline
database/baseline/v1 (13 unités, 4 080 lignes, RLS forcée, moteur de conditions,
60 permissions / 7 scopes) est du PostgreSQL 17.11 autonome SANS Supabase : son
schéma auth est vide réservé et elle exige l'injection du contexte transactionnel
schoolsafe.user_id|profile_id|school_id|request_id via api.set_request_context().
Aucun backend actuel n'effectue cette injection (0 occurrence de set_config dans
server/src et workers/src).

## Décision

1. La base de données cible est PostgreSQL 17.11 autonome selon database/baseline/v1.
2. PROVISIONAL : l'authentification est maison dans le schéma auth (email/téléphone +
   mot de passe argon2id, sessions opaques, refresh côté serveur). À ratifier après
   le spike. Alternative conservée : Supabase Auth uniquement pour la signature JWT.
3. L'API de l'école est le serveur Fastify du VPS. Après authentification vérifiée,
   chaque requête ouvre une transaction, appelle api.set_request_context(), puis
   n'accède aux données QUE par les fonctions du schéma api (le rôle schoolsafe_api
   n'a aucun privilège direct sur les tables).
4. Le Worker Cloudflare est gelé : aucune logique métier nouvelle ; repositionnement
   possible en edge statique/cache ultérieur (option C en horizon).
5. Supabase sort du chemin de données métier.

## Alternatives rejetées (scores pondérés d'audit)

- B — Worker → PostgreSQL VPS : 2,70/5. Hyperdrive absent, SET LOCAL à travers un
  pooler non prouvé, couverture 6/15 domaines, 9 tests, paiement non atomique.
- C — Worker gateway → Fastify → PG : 2,55/5. Trois sauts, deux codes, sur-ingénierie
  pour une instance mono-école.

## Conséquences

- Les services server/ sont portés du SDK Supabase vers des appels api.* (SQL).
- Le catalogue shared/permissions.json gagne ultérieurement un champ condition
  (le moteur iam.condition_matches existe déjà dans la baseline).
- app/shared/permissions.json doit être servi (précache SW aujourd'hui en 404).
- L'auth maison exige un lot dédié (hachage argon2id, sessions, révocation, audit).
