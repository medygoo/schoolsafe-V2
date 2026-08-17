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
