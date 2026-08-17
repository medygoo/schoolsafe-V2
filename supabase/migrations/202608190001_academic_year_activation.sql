-- SchoolSafe V2 — academic year activation helper
-- Deactivates every academic year except the one explicitly activated.

create or replace function public.deactivate_other_academic_years(p_school_id uuid, p_active_year_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.academic_years
  set is_active = false
  where school_id = p_school_id
    and id <> p_active_year_id;
$$;

revoke all on function public.deactivate_other_academic_years(uuid, uuid) from public;
grant execute on function public.deactivate_other_academic_years(uuid, uuid) to authenticated;
