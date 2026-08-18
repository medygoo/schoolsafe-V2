-- SchoolSafe V2 — C2 : clôtures de caisse et champs de reçu

-- Mode et référence de paiement pour les reçus
alter table public.fee_payments
  add column if not exists mode text,
  add column if not exists reference text;

comment on column public.fee_payments.mode is 'Mode de paiement (cash, card, transfer, mobile_money, etc.)';
comment on column public.fee_payments.reference is 'Référence externe du paiement';

-- ============================================================
-- Clôtures de caisse journalières
-- ============================================================
create table if not exists public.cash_register_closures (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  closure_date date not null,
  closed_by uuid not null references public.profiles(id) on delete restrict,
  closed_at timestamptz not null default now(),
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  expected_amount numeric(12, 2) check (expected_amount >= 0),
  difference numeric(12, 2) not null default 0,
  notes text,
  status text not null default 'closed' check (status in ('closed', 'reopened', 'adjusted')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, closure_date)
);

comment on table public.cash_register_closures is 'Clotures de caisse journalieres';

-- Index
create index if not exists cash_register_closures_school_date_idx on public.cash_register_closures(school_id, closure_date desc);

-- RLS
alter table public.cash_register_closures enable row level security;

revoke all on table public.cash_register_closures from anon, authenticated;

grant select, insert, update on public.cash_register_closures to authenticated;

create policy cash_register_closures_current_school
on public.cash_register_closures
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());
