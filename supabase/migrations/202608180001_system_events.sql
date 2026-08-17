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
