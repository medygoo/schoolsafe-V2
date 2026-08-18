create or replace function public.current_school_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select p.school_id
  from public.profiles p
  where p.id = public.current_profile_id()
  limit 1
$$;

create or replace function public.has_role_id(requested_role_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.profile_roles pr
    where pr.profile_id = public.current_profile_id()
      and pr.role_id = requested_role_id
  )
$$;

revoke all on function public.current_school_id() from public;
revoke all on function public.has_role_id(uuid) from public;
grant execute on function public.current_school_id() to authenticated;
grant execute on function public.has_role_id(uuid) to authenticated;

alter table public.school enable row level security;
alter table public.school_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.profile_roles enable row level security;
alter table public.role_permission_grants enable row level security;
alter table public.scope_assignments enable row level security;
alter table public.audit_events enable row level security;

grant select on public.school to authenticated;
grant select on public.school_settings to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update on public.devices to authenticated;
grant select on public.roles to authenticated;
grant select on public.permissions to authenticated;
grant select on public.profile_roles to authenticated;
grant select on public.role_permission_grants to authenticated;
grant select on public.scope_assignments to authenticated;
grant insert on public.audit_events to authenticated;

create policy school_select_current
on public.school
for select
to authenticated
using (id = public.current_school_id());

create policy school_settings_select_current
on public.school_settings
for select
to authenticated
using (school_id = public.current_school_id());

create policy profiles_select_self
on public.profiles
for select
to authenticated
using (id = public.current_profile_id());

create policy devices_select_self
on public.devices
for select
to authenticated
using (profile_id = public.current_profile_id());

create policy devices_insert_self
on public.devices
for insert
to authenticated
with check (profile_id = public.current_profile_id());

create policy devices_update_self
on public.devices
for update
to authenticated
using (profile_id = public.current_profile_id())
with check (profile_id = public.current_profile_id());

create policy roles_select_assigned
on public.roles
for select
to authenticated
using (public.has_role_id(id));

create policy permissions_select_granted
on public.permissions
for select
to authenticated
using (public.has_permission(code));

create policy profile_roles_select_self
on public.profile_roles
for select
to authenticated
using (profile_id = public.current_profile_id());

create policy role_permission_grants_select_assigned
on public.role_permission_grants
for select
to authenticated
using (public.has_role_id(role_id));

create policy scope_assignments_select_self
on public.scope_assignments
for select
to authenticated
using (profile_id = public.current_profile_id());

create policy audit_events_insert_self
on public.audit_events
for insert
to authenticated
with check (
  school_id = public.current_school_id()
  and actor_profile_id = public.current_profile_id()
);
