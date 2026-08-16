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
