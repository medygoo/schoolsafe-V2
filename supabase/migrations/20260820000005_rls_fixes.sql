-- SchoolSafe V2 — Corrections RLS P1 restantes
-- 1. school_settings : ajout de la politique UPDATE manquante.
-- 2. approval_requests : utilisation de public.current_school_id() au lieu de current_setting.

-- ============================================================
-- 1. school_settings : autoriser la mise à jour
-- ============================================================

grant update on public.school_settings to authenticated;

drop policy if exists school_settings_update_current on public.school_settings;

create policy school_settings_update_current
  on public.school_settings
  for update
  to authenticated
  using (school_id = public.current_school_id())
  with check (school_id = public.current_school_id());

-- ============================================================
-- 2. approval_requests : uniformiser avec public.current_school_id()
-- ============================================================

drop policy if exists approval_requests_current_school on public.approval_requests;

create policy approval_requests_current_school
  on public.approval_requests
  for all
  to authenticated
  using (school_id = public.current_school_id())
  with check (school_id = public.current_school_id());
