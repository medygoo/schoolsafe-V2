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
