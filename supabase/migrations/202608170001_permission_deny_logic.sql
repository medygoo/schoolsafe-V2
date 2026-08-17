-- Logique de permission avec deny qui l'emporte.
-- Une permission est accordée si au moins un rôle l'autorise (allowed = true)
-- et AUCUN rôle ne la refuse explicitement (allowed = false).

create or replace function public.has_permission(permission_code text)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    -- au moins un rôle autorise
    exists (
      select 1
      from public.profile_roles pr
      join public.role_permission_grants rpg on rpg.role_id = pr.role_id and rpg.allowed = true
      join public.permissions perm on perm.id = rpg.permission_id
      where pr.profile_id = public.current_profile_id()
        and perm.code = permission_code
    )
    and
    -- aucun rôle ne refuse explicitement
    not exists (
      select 1
      from public.profile_roles pr
      join public.role_permission_grants rpg on rpg.role_id = pr.role_id and rpg.allowed = false
      join public.permissions perm on perm.id = rpg.permission_id
      where pr.profile_id = public.current_profile_id()
        and perm.code = permission_code
    )
$$;

revoke all on function public.has_permission(text) from public;
grant execute on function public.has_permission(text) to authenticated;
