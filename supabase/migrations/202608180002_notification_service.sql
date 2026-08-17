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
