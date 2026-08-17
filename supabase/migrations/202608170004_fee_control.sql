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
