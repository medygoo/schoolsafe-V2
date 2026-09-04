\set ON_ERROR_STOP on

-- SchoolSafe Auth v1 — unité 02 : surface API d'authentification.
-- La vérification argon2id se fait dans le backend (Fastify) ; la base stocke
-- les hachés et gère sessions, tentatives et récupération. Aucune donnée ne
-- sort sans passer par ces fonctions.

begin;
set local role schoolsafe_owner;

-- Résolution pré-auth : trouve l'identité par e-mail OU téléphone.
-- Sortie volontairement identique qu'elle trouve ou non (anti-énumération :
-- le backend fait une vérification argon2 factice si l'identité est absente).
create or replace function api.auth_resolve_identity(p_login text)
returns table (
  identity_id uuid,
  user_id uuid,
  password_hash text,
  status text,
  must_change boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $schoolsafe$
begin
  if p_login is null or pg_catalog.btrim(p_login) = '' then
    return;
  end if;

  return query
  select i.id, i.user_id, c.password_hash, i.status, coalesce(c.must_change, false)
  from auth.identities i
  left join auth.credentials c on c.identity_id = i.id
  where i.email = p_login or i.phone = p_login
  limit 1;
end
$schoolsafe$;

-- Création de session après vérification du mot de passe par le backend.
create or replace function api.auth_create_session(
  p_identity_id uuid,
  p_token_hash text,
  p_ttl_seconds integer default 43200,
  p_ip inet default null,
  p_user_agent text default null
)
returns table (session_id uuid, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $schoolsafe$
declare
  v_identity auth.identities%rowtype;
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise check_violation using message = 'Invalid session token hash';
  end if;
  if p_ttl_seconds is null or p_ttl_seconds < 300 or p_ttl_seconds > 604800 then
    raise check_violation using message = 'Invalid session TTL';
  end if;

  select * into v_identity from auth.identities i where i.id = p_identity_id;
  if not found then
    raise foreign_key_violation using message = 'Unknown identity';
  end if;
  if v_identity.status <> 'active' then
    raise insufficient_privilege using message = 'Identity is disabled';
  end if;

  return query
  insert into auth.sessions (identity_id, token_hash, expires_at, ip, user_agent)
  values (
    p_identity_id,
    p_token_hash,
    pg_catalog.now() + pg_catalog.make_interval(secs => p_ttl_seconds),
    p_ip,
    p_user_agent
  )
  returning sessions.id, sessions.expires_at;
end
$schoolsafe$;

-- Résolution de session à chaque requête : identité complète si valide.
create or replace function api.auth_resolve_session(p_token_hash text)
returns table (
  session_id uuid,
  identity_id uuid,
  user_id uuid,
  profile_id uuid,
  school_id uuid,
  must_change boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $schoolsafe$
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    return;
  end if;

  return query
  select s.id, i.id, i.user_id, p.id, p.school_id, coalesce(c.must_change, false)
  from auth.sessions s
  join auth.identities i on i.id = s.identity_id
  join iam.profiles p on p.user_id = i.user_id and p.is_active = true
  left join auth.credentials c on c.identity_id = i.id
  where s.token_hash = p_token_hash
    and s.revoked_at is null
    and s.expires_at > pg_catalog.now()
    and i.status = 'active'
  limit 1;
end
$schoolsafe$;

-- Révocation (déconnexion ou action admin).
create or replace function api.auth_revoke_session(p_token_hash text)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $schoolsafe$
declare
  v_updated integer;
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  update auth.sessions
  set revoked_at = pg_catalog.now()
  where token_hash = p_token_hash and revoked_at is null;
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end
$schoolsafe$;

-- Journalisation des tentatives (verrouillage : 5 échecs / 15 min).
create or replace function api.auth_record_attempt(p_login text, p_succeeded boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $schoolsafe$
declare
  v_failures integer;
begin
  if p_login is null or pg_catalog.btrim(p_login) = '' then
    return false;
  end if;

  insert into auth.login_attempts (login, succeeded) values (p_login, p_succeeded);

  select pg_catalog.count(*) into v_failures
  from auth.login_attempts a
  where a.login = p_login
    and a.succeeded = false
    and a.attempted_at > pg_catalog.now() - pg_catalog.make_interval(mins => 15);

  return v_failures < 5;
end
$schoolsafe$;

-- Verrou actuel ? (lecture seule, appelée avant toute tentative)
create or replace function api.auth_is_locked(p_login text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $schoolsafe$
  select pg_catalog.count(*) >= 5
  from auth.login_attempts a
  where a.login = p_login
    and a.succeeded = false
    and a.attempted_at > pg_catalog.now() - pg_catalog.make_interval(mins => 15)
$schoolsafe$;

-- Changement de mot de passe (le haché est produit par le backend).
create or replace function api.auth_set_password(
  p_identity_id uuid,
  p_password_hash text,
  p_clear_must_change boolean default true
)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $schoolsafe$
declare
  v_updated integer;
begin
  if p_password_hash is null or not p_password_hash like '$argon2id$%' then
    raise check_violation using message = 'Password hash must be argon2id';
  end if;

  insert into auth.credentials (identity_id, password_hash, must_change, changed_at)
  values (p_identity_id, p_password_hash, not p_clear_must_change, pg_catalog.now())
  on conflict (identity_id) do update
  set password_hash = excluded.password_hash,
      must_change = not p_clear_must_change,
      changed_at = pg_catalog.now();
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end
$schoolsafe$;

-- ACL : le rôle API n'a accès qu'à ces fonctions (jamais aux tables auth).
revoke all on all tables in schema auth from schoolsafe_api;
grant execute on function api.auth_resolve_identity(text) to schoolsafe_api;
grant execute on function api.auth_create_session(uuid, text, integer, inet, text) to schoolsafe_api;
grant execute on function api.auth_resolve_session(text) to schoolsafe_api;
grant execute on function api.auth_revoke_session(text) to schoolsafe_api;
grant execute on function api.auth_record_attempt(text, boolean) to schoolsafe_api;
grant execute on function api.auth_is_locked(text) to schoolsafe_api;
grant execute on function api.auth_set_password(uuid, text, boolean) to schoolsafe_api;

commit;
