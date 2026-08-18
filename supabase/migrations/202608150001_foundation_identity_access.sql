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
