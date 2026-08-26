-- ============================================================ --
-- Indicator snapshots for trends and dashboards
-- ============================================================ --

create table if not exists public.indicator_snapshots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  snapshot_date date not null default current_date,
  indicator_code text not null,
  value numeric not null default 0,
  unit text not null default 'count',
  dimensions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.indicator_snapshots is 'Daily snapshots of key school indicators for trend analysis.';

-- Indexes
create index if not exists indicator_snapshots_school_date_idx on public.indicator_snapshots(school_id, snapshot_date);
create index if not exists indicator_snapshots_code_idx on public.indicator_snapshots(school_id, indicator_code, snapshot_date);

-- Prevent duplicate snapshots per day per indicator
create unique index if not exists indicator_snapshots_unique_daily
  on public.indicator_snapshots(school_id, snapshot_date, indicator_code, coalesce(dimensions, '{}'::jsonb));

-- RLS
alter table public.indicator_snapshots enable row level security;
revoke all on table public.indicator_snapshots from anon, authenticated;
grant select, insert on table public.indicator_snapshots to authenticated;

drop policy if exists indicator_snapshots_current_school on public.indicator_snapshots;
create policy indicator_snapshots_current_school
  on public.indicator_snapshots
  for all
  to authenticated
  using (school_id = current_setting('app.current_school_id', true)::uuid)
  with check (school_id = current_setting('app.current_school_id', true)::uuid);
