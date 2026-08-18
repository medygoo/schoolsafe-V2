create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select p.id
  from public.profiles p
  where p.auth_user_id = auth.uid()
    and p.is_active = true
  limit 1
$$;

create or replace function public.has_permission(permission_code text)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.profile_roles pr
    join public.role_permission_grants rpg on rpg.role_id = pr.role_id and rpg.allowed = true
    join public.permissions perm on perm.id = rpg.permission_id
    where pr.profile_id = public.current_profile_id()
      and perm.code = permission_code
  )
$$;

create or replace function public.has_scope(requested_scope_type text, requested_scope_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.scope_assignments sa
    where sa.profile_id = public.current_profile_id()
      and sa.scope_type = requested_scope_type
      and sa.scope_id is not distinct from requested_scope_id
  )
$$;

revoke all on function public.current_profile_id() from public;
revoke all on function public.has_permission(text) from public;
revoke all on function public.has_scope(text, uuid) from public;

grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.has_scope(text, uuid) to authenticated;
