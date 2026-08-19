-- ============================================================ --
-- Approval requests for sensitive transactional actions
-- ============================================================

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  request_type text not null check (request_type in ('payment_cancel', 'grade_change', 'fee_waiver', 'staff_role_change', 'discount_override')),
  entity_type text not null,
  entity_id uuid not null,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  expected_version integer not null default 1,
  payload jsonb not null default '{}'::jsonb,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.approval_requests is 'Workflow requests requiring an explicit approval before a sensitive action is applied.';
comment on column public.approval_requests.expected_version is 'Optimistic lock version of the target entity at request time.';

-- Indexes
create index if not exists approval_requests_school_id_idx on public.approval_requests(school_id);
create index if not exists approval_requests_status_idx on public.approval_requests(status);
create index if not exists approval_requests_entity_idx on public.approval_requests(entity_type, entity_id);
create index if not exists approval_requests_requested_by_idx on public.approval_requests(requested_by);

-- RLS
alter table public.approval_requests enable row level security;
revoke all on table public.approval_requests from anon, authenticated;
grant select, insert, update on table public.approval_requests to authenticated;

create policy approval_requests_current_school
  on public.approval_requests
  for all
  to authenticated
  using (school_id = current_setting('app.current_school_id', true)::uuid)
  with check (school_id = current_setting('app.current_school_id', true)::uuid);

-- Trigger to keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists approval_requests_updated_at on public.approval_requests;
create trigger approval_requests_updated_at
  before update on public.approval_requests
  for each row
  execute function public.set_updated_at();
