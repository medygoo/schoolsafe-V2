create table public.school (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.school_settings (
  school_id uuid primary key references public.school(id) on delete cascade,
  max_offline_hours integer not null default 24 check (max_offline_hours between 0 and 168),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  school_id uuid not null references public.school(id) on delete restrict,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  device_key text not null,
  kind text not null default 'unknown',
  is_school_managed boolean not null default false,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (profile_id, device_key)
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table public.profile_roles (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, role_id)
);

create table public.role_permission_grants (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  allowed boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table public.scope_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  scope_type text not null,
  scope_id uuid,
  label text,
  created_at timestamptz not null default now(),
  unique (profile_id, scope_type, scope_id)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete restrict,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

create index profiles_school_id_idx on public.profiles(school_id);
create index devices_profile_id_idx on public.devices(profile_id);
create index profile_roles_role_id_idx on public.profile_roles(role_id);
create index role_permission_grants_permission_id_idx on public.role_permission_grants(permission_id);
create index scope_assignments_profile_id_idx on public.scope_assignments(profile_id);
create index audit_events_school_created_idx on public.audit_events(school_id, created_at desc);

-- Foundation objects start closed. F1 RLS migrations will grant only the minimum authenticated access.
revoke all on table public.school from anon, authenticated;
revoke all on table public.school_settings from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.devices from anon, authenticated;
revoke all on table public.roles from anon, authenticated;
revoke all on table public.permissions from anon, authenticated;
revoke all on table public.profile_roles from anon, authenticated;
revoke all on table public.role_permission_grants from anon, authenticated;
revoke all on table public.scope_assignments from anon, authenticated;
revoke all on table public.audit_events from anon, authenticated;
create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select p.id
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.is_active = true
  limit 1
$$;

create or replace function public.has_permission(permission_code text)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.profile_roles pr
    join public.role_permission_grants rpg on rpg.role_id = pr.role_id and rpg.allowed = true
    join public.permissions perm on perm.id = rpg.permission_id
    where pr.profile_id = public.current_profile_id()
      and perm.code = permission_code
  )
$$;

create or replace function public.has_scope(requested_scope_type text, requested_scope_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.scope_assignments sa
    where sa.profile_id = public.current_profile_id()
      and sa.scope_type = requested_scope_type
      and sa.scope_id is not distinct from requested_scope_id
  )
$$;

revoke all on function public.current_profile_id() from public;
revoke all on function public.has_permission(text) from public;
revoke all on function public.has_scope(text, uuid) from public;

grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.has_scope(text, uuid) to authenticated;
create or replace function public.current_school_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select p.school_id
  from public.profiles p
  where p.id = public.current_profile_id()
  limit 1
$$;

create or replace function public.has_role_id(requested_role_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.profile_roles pr
    where pr.profile_id = public.current_profile_id()
      and pr.role_id = requested_role_id
  )
$$;

revoke all on function public.current_school_id() from public;
revoke all on function public.has_role_id(uuid) from public;
grant execute on function public.current_school_id() to authenticated;
grant execute on function public.has_role_id(uuid) to authenticated;

alter table public.school enable row level security;
alter table public.school_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.profile_roles enable row level security;
alter table public.role_permission_grants enable row level security;
alter table public.scope_assignments enable row level security;
alter table public.audit_events enable row level security;

grant select on public.school to authenticated;
grant select on public.school_settings to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update on public.devices to authenticated;
grant select on public.roles to authenticated;
grant select on public.permissions to authenticated;
grant select on public.profile_roles to authenticated;
grant select on public.role_permission_grants to authenticated;
grant select on public.scope_assignments to authenticated;
grant insert on public.audit_events to authenticated;

create policy school_select_current
on public.school
for select
to authenticated
using (id = public.current_school_id());

create policy school_settings_select_current
on public.school_settings
for select
to authenticated
using (school_id = public.current_school_id());

create policy profiles_select_self
on public.profiles
for select
to authenticated
using (id = public.current_profile_id());

create policy devices_select_self
on public.devices
for select
to authenticated
using (profile_id = public.current_profile_id());

create policy devices_insert_self
on public.devices
for insert
to authenticated
with check (profile_id = public.current_profile_id());

create policy devices_update_self
on public.devices
for update
to authenticated
using (profile_id = public.current_profile_id())
with check (profile_id = public.current_profile_id());

create policy roles_select_assigned
on public.roles
for select
to authenticated
using (public.has_role_id(id));

create policy permissions_select_granted
on public.permissions
for select
to authenticated
using (public.has_permission(code));

create policy profile_roles_select_self
on public.profile_roles
for select
to authenticated
using (profile_id = public.current_profile_id());

create policy role_permission_grants_select_assigned
on public.role_permission_grants
for select
to authenticated
using (public.has_role_id(role_id));

create policy scope_assignments_select_self
on public.scope_assignments
for select
to authenticated
using (profile_id = public.current_profile_id());

create policy audit_events_insert_self
on public.audit_events
for insert
to authenticated
with check (
  school_id = public.current_school_id()
  and actor_profile_id = public.current_profile_id()
);
-- SchoolSafe V2 — Étape 2 : configuration mono-école
-- Étend le schéma F1 existant pour stocker les informations saisies
-- pendant les 7 étapes de configuration de l'instance.

-- Identité et apparence de l'école
alter table public.school
  add column if not exists name_en text,
  add column if not exists legal_name text,
  add column if not exists school_type text not null default 'Privée agréée',
  add column if not exists approval_code text,
  add column if not exists primary_color text not null default '#071a3d',
  add column if not exists accent_color text not null default '#e9a515',
  add column if not exists document_footer text,
  add column if not exists logo_path text,
  add column if not exists setup_completed_at timestamptz;

-- Années scolaires (historisées)
create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  label text not null,
  starts_on date not null,
  ends_on date not null,
  periods text not null check (periods in ('Trimestres', 'Semestres')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cycles activés par l'école
create table if not exists public.school_cycles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  cycle_key text not null check (cycle_key in ('nursery', 'primary', 'secondary')),
  cycle_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, cycle_key)
);

-- Coordonnées officielles et paramètres du site public
create table if not exists public.school_contacts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  country text not null default 'République démocratique du Congo',
  province text not null default 'Kinshasa',
  city text not null default 'Kinshasa',
  address text,
  email text,
  phone text,
  website_url text,
  website_mode text not null default 'Créer un nouveau site SchoolSafe',
  public_news text not null default 'Après validation',
  public_gallery text not null default 'Après validation et consentement',
  public_honors text not null default 'Après validation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Profils : prénom, nom et téléphone pour la connexion e-mail/téléphone
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists phone text;

-- Indexes et commentaires
comment on column public.school.name is 'Nom officiel de l''école en français';
comment on column public.school.name_en is 'Nom officiel de l''école en anglais';
comment on column public.school.logo_path is 'Chemin du logo officiel sur le VPS (cartes + documents)';

create index if not exists academic_years_school_id_idx on public.academic_years(school_id);
create index if not exists academic_years_active_idx on public.academic_years(school_id, is_active);
create index if not exists school_cycles_school_id_idx on public.school_cycles(school_id);
create index if not exists school_contacts_school_id_idx on public.school_contacts(school_id);
create index if not exists profiles_phone_idx on public.profiles(phone);

-- RLS
alter table public.academic_years enable row level security;
alter table public.school_cycles enable row level security;
alter table public.school_contacts enable row level security;

revoke all on table public.academic_years from anon, authenticated;
revoke all on table public.school_cycles from anon, authenticated;
revoke all on table public.school_contacts from anon, authenticated;

grant select on public.academic_years to authenticated;
grant select on public.school_cycles to authenticated;
grant select on public.school_contacts to authenticated;

-- Les utilisateurs authentifiés peuvent mettre à jour leur propre profil
grant update (display_name, first_name, last_name, phone) on public.profiles to authenticated;

create policy academic_years_select_current
on public.academic_years
for select
to authenticated
using (school_id = public.current_school_id());

create policy school_cycles_select_current
on public.school_cycles
for select
to authenticated
using (school_id = public.current_school_id());

create policy school_contacts_select_current
on public.school_contacts
for select
to authenticated
using (school_id = public.current_school_id());

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = public.current_profile_id())
with check (id = public.current_profile_id());
-- SchoolSafe V2 — Sous-système de cartes élèves
-- Crée les tables minimales nécessaires à la production et au suivi des cartes.
-- Les tables students/classes/guardians seront enrichies par les modules métiers futurs.

-- ============================================================
-- 1. Classes (données minimales pour la carte)
-- ============================================================
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  cycle_key text not null check (cycle_key in ('nursery', 'primary', 'secondary')),
  name text not null,
  option text,
  teacher_id uuid references public.profiles(id) on delete set null,
  card_color text default '#e9a515',
  card_color_soft text default '#f9e8b8',
  card_color_dark text default '#b87e0d',
  card_pat text default 'auto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.classes.cycle_key is 'nursery = maternelle, primary = primaire, secondary = secondaire/humanités';
comment on column public.classes.card_pat is 'Patrimoine visuel choisi pour les cartes de cette classe';

-- ============================================================
-- 2. Élèves (données minimales pour la carte)
-- ============================================================
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  matricule text not null,
  first_name text not null,
  middle_name text,
  last_name text not null,
  date_of_birth date,
  gender text check (gender in ('M', 'F')),
  photo_path text,
  card_printed boolean not null default false,
  card_print_date date,
  card_print_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, matricule)
);

comment on column public.students.matricule is 'Numéro unique de l''élève dans l''école, encodé dans le QR code';
comment on column public.students.photo_path is 'Chemin de la photo sur R2 ou VPS';
comment on column public.students.card_printed is 'Une carte a déjà été imprimée au moins une fois';
comment on column public.students.card_print_count is 'Nombre total d''impressions (première + duplicatas)';

-- ============================================================
-- 3. Tuteurs / personnes autorisées
-- ============================================================
create table if not exists public.student_guardians (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  guardian_type text not null check (guardian_type in ('pere', 'mere', 'tuteur', 'autre')),
  is_primary boolean not null default false,
  full_name text not null,
  phone text,
  email text,
  address text,
  is_authorized_pickup boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.student_guardians.is_primary is 'Tuteur principal affiché sur la carte et identifié pour la récupération';
comment on column public.student_guardians.is_authorized_pickup is 'Personne autorisée à récupérer l''élève';

-- ============================================================
-- 4. Demandes d'impression de cartes
-- ============================================================
create table if not exists public.card_print_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  format text not null check (format in ('badge', 'carte')),
  is_duplicate boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'submitted', 'printed', 'failed')),
  front_image_url text,
  back_image_url text,
  front_r2_key text,
  back_r2_key text,
  metadata jsonb not null default '{}'::jsonb,
  control_app_reference text,
  error_message text,
  requested_at timestamptz not null default now(),
  submitted_at timestamptz,
  printed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.card_print_requests.format is 'badge = 340x540 px, carte = 560x353 px';
comment on column public.card_print_requests.status is 'pending → submitted → printed | failed';
comment on column public.card_print_requests.metadata is 'Matricule, nom, classe, format et autres métadonnées de la carte';

-- ============================================================
-- 5. Indexes
-- ============================================================
create index if not exists classes_school_id_idx on public.classes(school_id);
create index if not exists classes_academic_year_idx on public.classes(academic_year_id);
create index if not exists students_school_id_idx on public.students(school_id);
create index if not exists students_class_id_idx on public.students(class_id);
create index if not exists students_matricule_idx on public.students(school_id, matricule);
create index if not exists student_guardians_student_id_idx on public.student_guardians(student_id);
create index if not exists card_print_requests_school_id_idx on public.card_print_requests(school_id);
create index if not exists card_print_requests_student_id_idx on public.card_print_requests(student_id);
create index if not exists card_print_requests_status_idx on public.card_print_requests(school_id, status);

-- ============================================================
-- 6. RLS
-- ============================================================
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.student_guardians enable row level security;
alter table public.card_print_requests enable row level security;

revoke all on table public.classes from anon, authenticated;
revoke all on table public.students from anon, authenticated;
revoke all on table public.student_guardians from anon, authenticated;
revoke all on table public.card_print_requests from anon, authenticated;

grant select, insert, update on public.classes to authenticated;
grant select, insert, update on public.students to authenticated;
grant select, insert, update on public.student_guardians to authenticated;
grant select, insert, update on public.card_print_requests to authenticated;

create policy classes_current_school
on public.classes
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());

create policy students_current_school
on public.students
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());

create policy student_guardians_current_school
on public.student_guardians
for all
to authenticated
using (
  student_id in (
    select s.id from public.students s where s.school_id = public.current_school_id()
  )
)
with check (
  student_id in (
    select s.id from public.students s where s.school_id = public.current_school_id()
  )
);

create policy card_print_requests_current_school
on public.card_print_requests
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());
-- SchoolSafe V2 — Complément design des cartes par classe
-- Ajoute les champs nécessaires pour reproduire les familles, variantes et modes patrimoine.

alter table public.classes
  add column if not exists card_family text not null default 'A' check (card_family in ('A','B','C','D','E','F','G','H','I','J')),
  add column if not exists card_variant integer not null default 0 check (card_variant between 0 and 3),
  add column if not exists card_pat_style text not null default 'vignette' check (card_pat_style in ('vignette','fond','both'));

comment on column public.classes.card_family is 'Famille de design A-J (Arc-en-ciel, Océan, Pop Bento, Prestige Or, etc.)';
comment on column public.classes.card_variant is 'Index 0-3 de la variante de couleur dans la famille';
comment on column public.classes.card_pat_style is 'Mode d affichage du patrimoine : vignette, fond, ou both';
-- Logique de permission avec deny qui l'emporte.
-- Une permission est accordée si au moins un rôle l'autorise (allowed = true)
-- et AUCUN rôle ne la refuse explicitement (allowed = false).

create or replace function public.has_permission(permission_code text)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    -- au moins un rôle autorise
    exists (
      select 1
      from public.profile_roles pr
      join public.role_permission_grants rpg on rpg.role_id = pr.role_id and rpg.allowed = true
      join public.permissions perm on perm.id = rpg.permission_id
      where pr.profile_id = public.current_profile_id()
        and perm.code = permission_code
    )
    and
    -- aucun rôle ne refuse explicitement
    not exists (
      select 1
      from public.profile_roles pr
      join public.role_permission_grants rpg on rpg.role_id = pr.role_id and rpg.allowed = false
      join public.permissions perm on perm.id = rpg.permission_id
      where pr.profile_id = public.current_profile_id()
        and perm.code = permission_code
    )
$$;

revoke all on function public.has_permission(text) from public;
grant execute on function public.has_permission(text) to authenticated;
-- Ajout de la version et de la clé de contrôle sur les demandes de carte.
-- La version est incrémentée à chaque envoi (1 = première carte, 2+ = duplicata).

alter table public.card_print_requests
  add column if not exists version integer not null default 1,
  add column if not exists is_duplicate boolean not null default false;

create index if not exists card_print_requests_student_version_idx
  on public.card_print_requests(student_id, version desc);

-- Fonction atomique pour incrémenter le compteur d'impression d'un élève
-- et retourner la nouvelle version.
create or replace function public.increment_card_print_count(student_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_count integer;
begin
  update public.students
  set card_print_count = card_print_count + 1,
      card_printed = true,
      card_print_date = current_date
  where id = student_id
  returning card_print_count into new_count;

  return new_count;
end;
$$;

revoke all on function public.increment_card_print_count(uuid) from public;
grant execute on function public.increment_card_print_count(uuid) to authenticated;
-- SchoolSafe V2 — Incrément B1 : Sécurité QR + Moteur d'alertes
-- Crée les tables nécessaires au scan QR (entrées/sorties), aux cartes sécurisées,
-- aux postes/portes, aux règles d'alerte et aux alertes avec routage par rôle/utilisateur.

-- ============================================================
-- 1. Postes / portes / lieux de contrôle
-- ============================================================
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  code text not null,
  label text not null,
  kind text not null default 'gate' check (kind in ('gate', 'door', 'classroom', 'office', 'control_point')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, code)
);

comment on table public.locations is 'Postes de contrôle : portails, portes, classes, bureaux';

-- ============================================================
-- 2. Cartes élèves sécurisées (QR signé)
-- ============================================================
create table if not exists public.student_cards (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  card_number text not null,
  card_secret text not null,
  signature text not null,
  status text not null default 'active' check (status in ('active', 'lost', 'revoked', 'replaced')),
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  replaced_by_card_id uuid references public.student_cards(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, card_number)
);

comment on table public.student_cards is 'Cartes physiques des élèves avec numéro et signature HMAC pour QR';
comment on column public.student_cards.card_secret is 'Secret interne utilisé pour valider la signature du QR';
comment on column public.student_cards.signature is 'Signature HMAC présente dans le QR de la carte';

-- ============================================================
-- 3. Événements de sécurité (entrées, sorties, refus, incidents)
-- ============================================================
create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  card_id uuid references public.student_cards(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  event_type text not null check (event_type in ('entry', 'exit', 'exit_denied', 'incident', 'exit_prepared')),
  occurred_at timestamptz not null default now(),
  scanned_by uuid not null references public.profiles(id) on delete restrict,
  authorized_person_id uuid references public.student_guardians(id) on delete set null,
  decision text not null check (decision in ('allowed', 'denied', 'manual_override')),
  denial_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.security_events is 'Historique des scans QR : entrées, sorties, refus et incidents';

-- ============================================================
-- 4. Règles d'alerte
-- ============================================================
create table if not exists public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.school(id) on delete cascade,
  code text not null,
  domain text not null check (domain in ('security', 'attendance', 'finance', 'pedagogy', 'approval')),
  name text not null,
  description text,
  enabled boolean not null default true,
  severity text not null check (severity in ('critical', 'important', 'attention', 'information')),
  evaluation_mode text not null check (evaluation_mode in ('immediate', 'periodic')),
  cooldown_seconds integer not null default 3600,
  notify_channels text[] not null default '{}',
  target_roles text[] not null default '{}',
  condition_type text,
  threshold_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, code)
);

comment on table public.alert_rules is 'Règles configurables de génération d alertes';
comment on column public.alert_rules.target_roles is 'Codes de roles a notifier (ex. admin, school_head, guard)';
comment on column public.alert_rules.notify_channels is 'Canaux : in_app, email, whatsapp, sms';

-- ============================================================
-- 5. Alertes
-- ============================================================
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  rule_id uuid references public.alert_rules(id) on delete set null,
  source_module text not null,
  alert_type text not null,
  severity text not null check (severity in ('critical', 'important', 'attention', 'information')),
  title text not null,
  message text not null,
  entity_type text not null,
  entity_id text not null,
  dedup_key text not null,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved', 'cancelled')),
  detected_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  occurrence_count integer not null default 1,
  assigned_to uuid references public.profiles(id) on delete set null,
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolution_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.alerts is 'Alertes générées par le moteur de pilotage';

-- ============================================================
-- 6. Notifications d'alerte (routage par utilisateur + historique)
-- ============================================================
create table if not exists public.alert_notifications (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('in_app', 'email', 'whatsapp', 'sms', 'push')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'dismissed')),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

comment on table public.alert_notifications is 'Historique et routage des notifications par utilisateur';

-- ============================================================
-- 7. Index
-- ============================================================
create index if not exists locations_school_id_idx on public.locations(school_id);
create index if not exists student_cards_school_id_idx on public.student_cards(school_id);
create index if not exists student_cards_student_id_idx on public.student_cards(student_id);
create index if not exists student_cards_number_idx on public.student_cards(school_id, card_number);

create index if not exists security_events_school_id_idx on public.security_events(school_id);
create index if not exists security_events_student_id_idx on public.security_events(student_id);
create index if not exists security_events_occurred_at_idx on public.security_events(school_id, occurred_at desc);
create index if not exists security_events_type_idx on public.security_events(school_id, event_type);

create index if not exists alert_rules_school_id_idx on public.alert_rules(school_id);
create index if not exists alerts_school_id_idx on public.alerts(school_id);
create index if not exists alerts_status_idx on public.alerts(school_id, status);
create index if not exists alerts_severity_idx on public.alerts(school_id, severity);
create index if not exists alerts_detected_at_idx on public.alerts(school_id, detected_at desc);

-- Déduplication : une seule alerte active par clé
create unique index if not exists ux_active_alert_dedup
  on public.alerts (school_id, dedup_key)
  where status in ('open', 'acknowledged');

create index if not exists alert_notifications_alert_id_idx on public.alert_notifications(alert_id);
create index if not exists alert_notifications_profile_id_idx on public.alert_notifications(profile_id);

-- ============================================================
-- 8. Lockdown global par école
-- ============================================================
alter table public.school_settings
  add column if not exists lockdown_active boolean not null default false,
  add column if not exists lockdown_activated_at timestamptz,
  add column if not exists lockdown_activated_by uuid references public.profiles(id) on delete set null;

comment on column public.school_settings.lockdown_active is 'Si vrai, aucune sortie d eleve n est autorisee';

-- ============================================================
-- 9. RLS
-- ============================================================
alter table public.locations enable row level security;
alter table public.student_cards enable row level security;
alter table public.security_events enable row level security;
alter table public.alert_rules enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_notifications enable row level security;

revoke all on table public.locations from anon, authenticated;
revoke all on table public.student_cards from anon, authenticated;
revoke all on table public.security_events from anon, authenticated;
revoke all on table public.alert_rules from anon, authenticated;
revoke all on table public.alerts from anon, authenticated;
revoke all on table public.alert_notifications from anon, authenticated;

grant select, insert, update on public.locations to authenticated;
grant select, insert, update on public.student_cards to authenticated;
grant select, insert on public.security_events to authenticated;
grant select on public.alert_rules to authenticated;
grant select, insert, update on public.alerts to authenticated;
grant select, insert on public.alert_notifications to authenticated;

create policy locations_current_school
on public.locations
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());

create policy student_cards_current_school
on public.student_cards
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());

create policy security_events_current_school
on public.security_events
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());

create policy alert_rules_current_school
on public.alert_rules
for all
to authenticated
using (school_id is null or school_id = public.current_school_id())
with check (school_id = public.current_school_id());

create policy alerts_current_school
on public.alerts
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());

create policy alert_notifications_current_school
on public.alert_notifications
for all
to authenticated
using (alert_id in (select a.id from public.alerts a where a.school_id = public.current_school_id()))
with check (alert_id in (select a.id from public.alerts a where a.school_id = public.current_school_id()));

-- ============================================================
-- 10. Règles système par défaut
-- ============================================================
insert into public.alert_rules (school_id, code, domain, name, description, severity, evaluation_mode, cooldown_seconds, notify_channels, target_roles)
values
  (null, 'EXIT_DENIED', 'security', 'Tentative de sortie non autorisée', 'Une personne non autorisee a tente de faire sortir un eleve', 'critical', 'immediate', 0, array['in_app', 'email', 'whatsapp'], array['admin', 'school_head', 'guard']),
  (null, 'LATE_STUDENT', 'security', 'Eleve encore present apres l heure attendue', 'Un eleve est toujours sur le site apres l heure prevue de sortie', 'important', 'periodic', 1800, array['in_app', 'email'], array['admin', 'school_head', 'guard']),
  (null, 'SECURITY_INCIDENT', 'security', 'Incident de securite', 'Un incident grave a ete signale au poste de securite', 'critical', 'immediate', 0, array['in_app', 'email', 'whatsapp'], array['admin', 'school_head', 'guard'])
on conflict (school_id, code) do nothing;
-- SchoolSafe V2 — Incrément B2 : Contrôle des frais par QR
-- Tables minimales pour la gestion des frais scolaires et les campagnes de contrôle.

-- ============================================================
-- 1. Structure des frais par cycle et année scolaire
-- ============================================================
create table if not exists public.fee_structures (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  cycle_key text not null check (cycle_key in ('nursery', 'primary', 'secondary')),
  label text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'USD' check (currency in ('USD', 'CDF')),
  due_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.fee_structures is 'Grille des frais scolaires par cycle et annee';

-- ============================================================
-- 2. Situation financière de chaque élève
-- ============================================================
create table if not exists public.student_fees (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  fee_structure_id uuid not null references public.fee_structures(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'partial', 'paid', 'exempted')),
  amount_expected numeric(12, 2) not null check (amount_expected >= 0),
  amount_paid numeric(12, 2) not null default 0 check (amount_paid >= 0),
  amount_remaining numeric(12, 2) not null check (amount_remaining >= 0),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (student_id, fee_structure_id)
);

comment on table public.student_fees is 'Situation financiere individuelle de l eleve par frais';

-- ============================================================
-- 3. Paiements enregistrés
-- ============================================================
create table if not exists public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  student_fee_id uuid not null references public.student_fees(id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'USD' check (currency in ('USD', 'CDF')),
  received_by uuid not null references public.profiles(id) on delete restrict,
  received_at timestamptz not null default now(),
  receipt_no text,
  status text not null default 'valid' check (status in ('valid', 'cancelled', 'refund_pending')),
  cancellation_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.fee_payments is 'Paiements recus pour un frais scolaire';

-- ============================================================
-- 4. Campagnes de contrôle des frais
-- ============================================================
create table if not exists public.fee_control_campaigns (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  fee_structure_id uuid not null references public.fee_structures(id) on delete restrict,
  label text not null,
  description text,
  classes uuid[] not null default '{}',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed', 'archived')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.fee_control_campaigns is 'Campagnes de controle des frais par QR';

-- ============================================================
-- 5. Contrôleurs assignés à une campagne
-- ============================================================
create table if not exists public.fee_control_assignees (
  campaign_id uuid not null references public.fee_control_campaigns(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (campaign_id, profile_id)
);

-- ============================================================
-- 6. Scans de contrôle des frais
-- ============================================================
create table if not exists public.fee_control_scans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  campaign_id uuid not null references public.fee_control_campaigns(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  scanned_by uuid not null references public.profiles(id) on delete restrict,
  location_id uuid references public.locations(id) on delete set null,
  student_fee_status text not null check (student_fee_status in ('pending', 'partial', 'paid', 'exempted')),
  result text not null check (result in ('ok', 'partial', 'unpaid', 'exempted', 'anomaly')),
  notes text,
  scanned_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.fee_control_scans is 'Historique des scans de controle des frais';

-- ============================================================
-- 7. Index
-- ============================================================
create index if not exists fee_structures_school_id_idx on public.fee_structures(school_id);
create index if not exists fee_structures_year_cycle_idx on public.fee_structures(academic_year_id, cycle_key);

create index if not exists student_fees_school_id_idx on public.student_fees(school_id);
create index if not exists student_fees_student_id_idx on public.student_fees(student_id);
create index if not exists student_fees_status_idx on public.student_fees(school_id, status);

create index if not exists fee_payments_school_id_idx on public.fee_payments(school_id);
create index if not exists fee_payments_student_fee_id_idx on public.fee_payments(student_fee_id);

create index if not exists fee_control_campaigns_school_id_idx on public.fee_control_campaigns(school_id);
create index if not exists fee_control_campaigns_status_idx on public.fee_control_campaigns(school_id, status);

create index if not exists fee_control_scans_school_id_idx on public.fee_control_scans(school_id);
create index if not exists fee_control_scans_campaign_id_idx on public.fee_control_scans(campaign_id);
create index if not exists fee_control_scans_student_id_idx on public.fee_control_scans(student_id);

-- ============================================================
-- 8. RLS
-- ============================================================
alter table public.fee_structures enable row level security;
alter table public.student_fees enable row level security;
alter table public.fee_payments enable row level security;
alter table public.fee_control_campaigns enable row level security;
alter table public.fee_control_assignees enable row level security;
alter table public.fee_control_scans enable row level security;

revoke all on table public.fee_structures from anon, authenticated;
revoke all on table public.student_fees from anon, authenticated;
revoke all on table public.fee_payments from anon, authenticated;
revoke all on table public.fee_control_campaigns from anon, authenticated;
revoke all on table public.fee_control_assignees from anon, authenticated;
revoke all on table public.fee_control_scans from anon, authenticated;

grant select, insert, update on public.fee_structures to authenticated;
grant select, insert, update on public.student_fees to authenticated;
grant select, insert, update on public.fee_payments to authenticated;
grant select, insert, update on public.fee_control_campaigns to authenticated;
grant select, insert, update on public.fee_control_assignees to authenticated;
grant select, insert on public.fee_control_scans to authenticated;

create policy fee_structures_current_school
on public.fee_structures
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());

create policy student_fees_current_school
on public.student_fees
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());

create policy fee_payments_current_school
on public.fee_payments
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());

create policy fee_control_campaigns_current_school
on public.fee_control_campaigns
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());

create policy fee_control_assignees_current_school
on public.fee_control_assignees
for all
to authenticated
using (campaign_id in (select c.id from public.fee_control_campaigns c where c.school_id = public.current_school_id()))
with check (campaign_id in (select c.id from public.fee_control_campaigns c where c.school_id = public.current_school_id()));

create policy fee_control_scans_current_school
on public.fee_control_scans
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());
-- SchoolSafe V2 — Module Pédagogie, Phase 1
-- Fondation : matières, affectations enseignants, devoirs, cotations, cahier de préparation.
-- Pas de calcul de moyenne dans cette phase ; on stocke les données brutes.

-- ============================================================
-- 1. Matières (par langue, par cycle)
-- ============================================================
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  cycle_key text not null check (cycle_key in ('nursery', 'primary', 'secondary')),
  code text not null,
  name text not null,
  language text not null check (language in ('FR', 'EN')),
  subject_family_code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, code, language)
);

comment on column public.subjects.code is 'Code métier de la matière, ex. MATH, FRAN, ENGL';
comment on column public.subjects.language is 'Langue du parcours pédagogique : FR ou EN';
comment on column public.subjects.subject_family_code is 'Permet de regrouper les variantes FR/EN d''une même matière sans les forcer à fusionner';

-- ============================================================
-- 2. Affectations enseignant ↔ classe ↔ matière
--    subject_id NULL + is_tutor = vrai → titulaire de la classe
-- ============================================================
create table if not exists public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  is_tutor boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_assignment_target check (
    (subject_id is not null) or (is_tutor = true)
  )
);

comment on column public.teacher_assignments.is_tutor is 'Titulaire de la classe ; subject_id doit être NULL dans ce cas';

-- ============================================================
-- 3. Devoirs / évaluations
-- ============================================================
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  type text not null check (type in ('homework', 'quiz', 'exam', 'compensatory')),
  scale_mode text not null default 'numeric' check (scale_mode in ('numeric', 'qualitative', 'custom')),
  scale_max numeric,
  scale_label text,
  coefficient numeric not null default 1,
  due_date date,
  prerequisites text,
  instructions text,
  language text not null check (language in ('FR', 'EN')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.assignments.scale_mode is 'numeric = valeur chiffrée, qualitative = appréciation, custom = libre';
comment on column public.assignments.scale_label is 'Libellé libre de l''échelle : /20, /10, %, Acquis/En acquisition…';
comment on column public.assignments.coefficient is 'Coefficient pédagogique du devoir, configurable par l''enseignant';

-- ============================================================
-- 4. Questions d'un devoir
-- ============================================================
create table if not exists public.assignment_questions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  text text not null,
  type text not null,
  points numeric,
  answer_space text,
  choices text,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 5. Cotations
-- ============================================================
create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  value_numeric numeric,
  value_text text,
  normalized_value numeric,
  comment text,
  change_reason text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

comment on column public.grades.normalized_value is 'Valeur normalisée (ex. pourcentage) pour futur calcul de moyenne';
comment on column public.grades.change_reason is 'Motif de modification d''une cote déjà publiée';

-- ============================================================
-- 6. Cahier de préparation
-- ============================================================
create table if not exists public.lesson_plans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  lesson_date date not null,
  objectives text,
  materials text,
  procedure text,
  homework_assignment_id uuid references public.assignments(id) on delete set null,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.lesson_plans.attachments is 'Liste de pièces jointes : {name, url, type}';

-- ============================================================
-- 7. Indexes
-- ============================================================
create index if not exists subjects_school_id_idx on public.subjects(school_id);
create index if not exists subjects_cycle_idx on public.subjects(school_id, cycle_key);
create index if not exists teacher_assignments_school_id_idx on public.teacher_assignments(school_id);
create index if not exists teacher_assignments_class_id_idx on public.teacher_assignments(class_id);
create index if not exists teacher_assignments_teacher_id_idx on public.teacher_assignments(teacher_id);
create index if not exists assignments_school_id_idx on public.assignments(school_id);
create index if not exists assignments_class_id_idx on public.assignments(class_id);
create index if not exists assignments_subject_id_idx on public.assignments(subject_id);
create index if not exists assignments_teacher_id_idx on public.assignments(teacher_id);
create index if not exists assignment_questions_assignment_id_idx on public.assignment_questions(assignment_id);
create index if not exists grades_assignment_id_idx on public.grades(assignment_id);
create index if not exists grades_student_id_idx on public.grades(student_id);
create index if not exists lesson_plans_school_id_idx on public.lesson_plans(school_id);
create index if not exists lesson_plans_class_id_idx on public.lesson_plans(class_id);
create index if not exists lesson_plans_teacher_id_idx on public.lesson_plans(teacher_id);

-- ============================================================
-- 8. RLS
-- ============================================================
alter table public.subjects enable row level security;
alter table public.teacher_assignments enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_questions enable row level security;
alter table public.grades enable row level security;
alter table public.lesson_plans enable row level security;

revoke all on table public.subjects from anon, authenticated;
revoke all on table public.teacher_assignments from anon, authenticated;
revoke all on table public.assignments from anon, authenticated;
revoke all on table public.assignment_questions from anon, authenticated;
revoke all on table public.grades from anon, authenticated;
revoke all on table public.lesson_plans from anon, authenticated;

grant select, insert, update on public.subjects to authenticated;
grant select, insert, update, delete on public.teacher_assignments to authenticated;
grant select, insert, update on public.assignments to authenticated;
grant select, insert, update, delete on public.assignment_questions to authenticated;
grant select, insert, update on public.grades to authenticated;
grant select, insert, update on public.lesson_plans to authenticated;

create policy subjects_current_school
on public.subjects
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());

create policy teacher_assignments_current_school
on public.teacher_assignments
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());

create policy assignments_current_school
on public.assignments
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());

create policy assignment_questions_current_school
on public.assignment_questions
for all
to authenticated
using (
  assignment_id in (
    select a.id from public.assignments a where a.school_id = public.current_school_id()
  )
)
with check (
  assignment_id in (
    select a.id from public.assignments a where a.school_id = public.current_school_id()
  )
);

create policy grades_current_school
on public.grades
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());

create policy lesson_plans_current_school
on public.lesson_plans
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());
-- SchoolSafe V2 — Phase 2 : système d'événements internes
-- File d'événements métier découplée des modules et des notifications.
-- Permet de remplacer plus tard le traitement local par Cloudflare Queues
-- sans réécrire les modules métiers.

create table if not exists public.system_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  user_id uuid references public.profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.system_events is 'File d événements métiers internes (QR, présence, paiement, note publiée, etc.)';
comment on column public.system_events.event_type is 'Type métier de l événement, ex. STUDENT_ENTERED, STUDENT_EXITED, PAYMENT_RECORDED';
comment on column public.system_events.status is 'pending → processing → completed | failed | cancelled';

-- Index pour consommer les événements par ordre de création
create index if not exists system_events_school_status_created_idx
  on public.system_events (school_id, status, created_at);

create index if not exists system_events_entity_idx
  on public.system_events (entity_type, entity_id)
  where entity_type is not null and entity_id is not null;

-- RLS
alter table public.system_events enable row level security;

revoke all on table public.system_events from anon, authenticated;

grant select, insert on public.system_events to authenticated;

create policy system_events_current_school
on public.system_events
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());
-- SchoolSafe V2 — Phase 2 : service de notifications centralisé
-- Templates paramétrables et file de notifications sortantes.
-- Les modules métiers appellent notificationService.send(...) ;
-- ce service choisit le canal et le provider (Brevo, SMS futur, in-app).

-- ============================================================
-- 1. Templates de messages par événement et canal
-- ============================================================
create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.school(id) on delete cascade,
  event_type text not null,
  channel text not null check (channel in ('EMAIL', 'SMS', 'IN_APP', 'PUSH')),
  language text not null default 'fr',
  subject text,
  body text not null,
  variables jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, event_type, channel, language)
);

comment on table public.notification_templates is 'Templates de notification paramétrables par école, événement, canal et langue';
comment on column public.notification_templates.school_id is 'NULL = template système par défaut';
comment on column public.notification_templates.variables is 'Liste des variables attendues dans le template, ex. ["parent_name", "student_name", "time"]';

-- ============================================================
-- 2. File de notifications sortantes
-- ============================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid references public.system_events(id) on delete set null,
  channel text not null check (channel in ('EMAIL', 'SMS', 'IN_APP', 'PUSH')),
  template_key text,
  title text,
  message text not null,
  recipient_email text,
  recipient_phone text,
  status text not null default 'PENDING' check (status in ('PENDING', 'QUEUED', 'SENT', 'FAILED', 'DELIVERED', 'DISMISSED')),
  provider text check (provider in ('BREVO', 'SMS_PROVIDER', 'INTERNAL')),
  provider_message_id text,
  retry_count integer not null default 0,
  max_retries integer not null default 3,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.notifications is 'File de notifications sortantes gérées par le NotificationService';
comment on column public.notifications.event_id is 'Événement source ayant déclenché la notification';
comment on column public.notifications.status is 'PENDING → QUEUED → SENT → DELIVERED | FAILED | DISMISSED';

-- ============================================================
-- 3. Index
-- ============================================================
create index if not exists notification_templates_school_idx
  on public.notification_templates (school_id, event_type, channel, language);

create index if not exists notifications_school_status_created_idx
  on public.notifications (school_id, status, created_at);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, status, created_at desc)
  where status in ('PENDING', 'QUEUED', 'SENT');

create index if not exists notifications_event_id_idx
  on public.notifications (event_id)
  where event_id is not null;

-- ============================================================
-- 4. RLS
-- ============================================================
alter table public.notification_templates enable row level security;
alter table public.notifications enable row level security;

revoke all on table public.notification_templates from anon, authenticated;
revoke all on table public.notifications from anon, authenticated;

grant select on public.notification_templates to authenticated;
grant select, insert, update on public.notifications to authenticated;

create policy notification_templates_current_school
on public.notification_templates
for all
to authenticated
using (school_id is null or school_id = public.current_school_id())
with check (school_id = public.current_school_id());

create policy notifications_current_school
on public.notifications
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());
-- SchoolSafe V2 — Phase 2 : politiques de rétention des données
-- Permet de configurer par type de donnée combien de temps elle reste
-- dans PostgreSQL avant d'être archivée vers D1/R2 ou supprimée.

create table if not exists public.data_retention_policies (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.school(id) on delete cascade,
  entity_type text not null,
  retention_days integer not null check (retention_days > 0),
  archive_target text not null check (archive_target in ('D1', 'R2', 'NONE')),
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, entity_type)
);

comment on table public.data_retention_policies is 'Durée de rétention PostgreSQL et destination d archive par type de donnée';
comment on column public.data_retention_policies.school_id is 'NULL = politique système par défaut';
comment on column public.data_retention_policies.entity_type is 'Type de donnée concerné : raw_qr_scans, notification_attempts, technical_logs, etc.';
comment on column public.data_retention_policies.archive_target is 'D1 = base historique consultable, R2 = fichiers, NONE = suppression après rétention';

-- Valeurs par défaut système
insert into public.data_retention_policies (school_id, entity_type, retention_days, archive_target, description)
values
  (null, 'raw_qr_scans', 30, 'D1', 'Scans QR bruts non consolidés'),
  (null, 'notification_attempts', 30, 'D1', 'Tentatives et résultats de notification'),
  (null, 'technical_logs', 7, 'R2', 'Logs techniques et API'),
  (null, 'alert_notifications', 30, 'D1', 'Notifications d alertes envoyées'),
  (null, 'resolved_alerts', 90, 'D1', 'Alertes résolues ou annulées'),
  (null, 'audit_events', 365, 'D1', 'Journal d audit')
on conflict (school_id, entity_type) do nothing;

-- Index et RLS
create index if not exists data_retention_policies_school_idx
  on public.data_retention_policies (school_id, entity_type);

alter table public.data_retention_policies enable row level security;

revoke all on table public.data_retention_policies from anon, authenticated;

grant select on public.data_retention_policies to authenticated;

create policy data_retention_policies_current_school
on public.data_retention_policies
for all
to authenticated
using (school_id is null or school_id = public.current_school_id())
with check (school_id = public.current_school_id());
-- Templates système par défaut pour les notifications de sécurité QR
-- school_id NULL = template applicable à toutes les écoles

insert into public.notification_templates (school_id, event_type, channel, language, subject, body, variables, active)
values
  -- STUDENT_ENTERED
  (null, 'STUDENT_ENTERED', 'EMAIL', 'fr', 'Entrée à l''école', 'Bonjour {{parent_name}}, {{student_name}} est entré(e) à l''école à {{time}} le {{date}}.', '["parent_name", "student_name", "time", "date"]'::jsonb, true),
  (null, 'STUDENT_ENTERED', 'IN_APP', 'fr', 'Entrée enregistrée', '{{student_name}} est entré(e) à {{time}}.', '["student_name", "time"]'::jsonb, true),
  (null, 'STUDENT_ENTERED', 'PUSH', 'fr', 'Entrée', '{{student_name}} est entré(e) à l''école.', '["student_name"]'::jsonb, true),

  -- STUDENT_EXITED
  (null, 'STUDENT_EXITED', 'EMAIL', 'fr', 'Sortie de l''école', 'Bonjour {{parent_name}}, {{student_name}} est sorti(e) à {{time}} le {{date}} avec {{authorized_person_name}}.', '["parent_name", "student_name", "time", "date", "authorized_person_name"]'::jsonb, true),
  (null, 'STUDENT_EXITED', 'IN_APP', 'fr', 'Sortie enregistrée', '{{student_name}} est sorti(e) à {{time}} avec {{authorized_person_name}}.', '["student_name", "time", "authorized_person_name"]'::jsonb, true),
  (null, 'STUDENT_EXITED', 'PUSH', 'fr', 'Sortie', '{{student_name}} est sorti(e) de l''école.', '["student_name"]'::jsonb, true),

  -- UNAUTHORIZED_EXIT_ATTEMPT
  (null, 'UNAUTHORIZED_EXIT_ATTEMPT', 'EMAIL', 'fr', 'Tentative de sortie non autorisée', 'Bonjour {{parent_name}}, une tentative de sortie non autorisée a été signalée pour {{student_name}} à {{time}}.', '["parent_name", "student_name", "time"]'::jsonb, true),
  (null, 'UNAUTHORIZED_EXIT_ATTEMPT', 'IN_APP', 'fr', 'Alerte sécurité', 'Tentative de sortie non autorisée pour {{student_name}}.', '["student_name"]'::jsonb, true),
  (null, 'UNAUTHORIZED_EXIT_ATTEMPT', 'PUSH', 'fr', 'Alerte sécurité', 'Tentative de sortie non autorisée pour {{student_name}}.', '["student_name"]'::jsonb, true),

  -- LOCKDOWN_ACTIVATED
  (null, 'LOCKDOWN_ACTIVATED', 'EMAIL', 'fr', 'Mode lockdown activé', 'Le mode lockdown a été activé par {{activated_by_name}} à {{time}}. Les sorties d''élèves sont temporairement interdites.', '["activated_by_name", "time"]'::jsonb, true),
  (null, 'LOCKDOWN_ACTIVATED', 'IN_APP', 'fr', 'Lockdown', 'Mode lockdown activé à {{time}}.', '["time"]'::jsonb, true),
  (null, 'LOCKDOWN_ACTIVATED', 'PUSH', 'fr', 'Lockdown', 'Mode lockdown activé.', '[]'::jsonb, true)
on conflict (school_id, event_type, channel, language) do update set
  subject = excluded.subject,
  body = excluded.body,
  variables = excluded.variables,
  active = excluded.active;
-- SchoolSafe V2 — academic year activation helper
-- Deactivates every academic year except the one explicitly activated.

create or replace function public.deactivate_other_academic_years(p_school_id uuid, p_active_year_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.academic_years
  set is_active = false
  where school_id = p_school_id
    and id <> p_active_year_id;
$$;

revoke all on function public.deactivate_other_academic_years(uuid, uuid) from public;
grant execute on function public.deactivate_other_academic_years(uuid, uuid) to authenticated;
grant execute on function public.deactivate_other_academic_years(uuid, uuid) to service_role;
