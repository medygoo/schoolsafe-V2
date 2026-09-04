\set ON_ERROR_STOP on

-- SchoolSafe Auth v1 — unité 01 : tables du schéma auth.
-- S'applique APRÈS la baseline v1 (le schéma auth existe, vide réservé).
-- Même discipline : transactionnel, rôle owner, RLS forcée, aucun accès direct.

begin;
set local role schoolsafe_owner;

create table if not exists auth.identities (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references iam.users (id),
  email citext,
  phone text,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  check (email is not null or phone is not null)
);

create unique index if not exists identities_email_unique
  on auth.identities (email) where email is not null;
create unique index if not exists identities_phone_unique
  on auth.identities (phone) where phone is not null;
create unique index if not exists identities_user_unique
  on auth.identities (user_id);

create table if not exists auth.credentials (
  identity_id uuid primary key references auth.identities (id),
  password_hash text not null,
  algo_version text not null default 'argon2id-v1',
  must_change boolean not null default false,
  changed_at timestamptz not null default pg_catalog.now()
);

create table if not exists auth.sessions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  identity_id uuid not null references auth.identities (id),
  token_hash text not null unique,
  created_at timestamptz not null default pg_catalog.now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  ip inet,
  user_agent text
);

create index if not exists sessions_identity_idx on auth.sessions (identity_id);
create index if not exists sessions_expires_idx on auth.sessions (expires_at);

create table if not exists auth.login_attempts (
  id bigint generated always as identity primary key,
  login text not null,
  succeeded boolean not null,
  attempted_at timestamptz not null default pg_catalog.now()
);

create index if not exists login_attempts_login_idx
  on auth.login_attempts (login, attempted_at);

create table if not exists auth.recovery_requests (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  identity_id uuid not null references auth.identities (id),
  token_hash text not null unique,
  requested_by uuid references iam.profiles (id),
  created_at timestamptz not null default pg_catalog.now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

commit;
