BEGIN;

insert into auth.users (
  id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('41000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'teacher-rls@test.local', now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('41000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'parent-rls@test.local', now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, auth_user_id, school_id, display_name) values
  ('51000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Teacher RLS'),
  ('51000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Parent RLS');

insert into public.profile_roles (profile_id, role_id) values
  ('51000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004'),
  ('51000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000007');

insert into public.role_permission_grants (role_id, permission_id, allowed)
values ('20000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000003', true)
on conflict (role_id, permission_id) do update set allowed = excluded.allowed;

insert into public.devices (id, profile_id, device_key, kind) values
  ('61000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'teacher-device', 'browser'),
  ('61000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000002', 'parent-device', 'phone');

insert into public.scope_assignments (id, profile_id, scope_type, scope_id, label) values
  ('71000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'school', '10000000-0000-0000-0000-000000000001', 'Test school'),
  ('71000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000002', 'school', '10000000-0000-0000-0000-000000000001', 'Test school');

select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  row_count integer;
BEGIN
  select count(*) into row_count from public.profiles where id = '51000000-0000-0000-0000-000000000001';
  IF row_count <> 1 THEN RAISE EXCEPTION 'F1 RLS: own profile must be visible'; END IF;

  select count(*) into row_count from public.profiles where id = '51000000-0000-0000-0000-000000000002';
  IF row_count <> 0 THEN RAISE EXCEPTION 'F1 RLS: other profile leaked'; END IF;

  select count(*) into row_count from public.devices where id = '61000000-0000-0000-0000-000000000001';
  IF row_count <> 1 THEN RAISE EXCEPTION 'F1 RLS: own device must be visible'; END IF;

  select count(*) into row_count from public.devices where id = '61000000-0000-0000-0000-000000000002';
  IF row_count <> 0 THEN RAISE EXCEPTION 'F1 RLS: other device leaked'; END IF;

  select count(*) into row_count from public.roles where code = 'teacher';
  IF row_count <> 1 THEN RAISE EXCEPTION 'F1 RLS: assigned role must be visible'; END IF;

  select count(*) into row_count from public.permissions where code = 'school.student.read';
  IF row_count <> 1 THEN RAISE EXCEPTION 'F1 RLS: granted permission must be visible'; END IF;

  select count(*) into row_count from public.scope_assignments where profile_id = '51000000-0000-0000-0000-000000000001';
  IF row_count <> 1 THEN RAISE EXCEPTION 'F1 RLS: own scope must be visible'; END IF;

  select count(*) into row_count from public.school where id = '10000000-0000-0000-0000-000000000001';
  IF row_count <> 1 THEN RAISE EXCEPTION 'F1 RLS: own school must be visible'; END IF;

  select count(*) into row_count from public.school_settings where school_id = '10000000-0000-0000-0000-000000000001';
  IF row_count <> 1 THEN RAISE EXCEPTION 'F1 RLS: own school settings must be visible'; END IF;
END
$$;

DO $$
BEGIN
  BEGIN
    insert into public.profile_roles (profile_id, role_id)
    values ('51000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'F1 RLS: user forged admin role';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    update public.role_permission_grants
    set allowed = false
    where role_id = '20000000-0000-0000-0000-000000000004'
      and permission_id = '30000000-0000-0000-0000-000000000003';
    RAISE EXCEPTION 'F1 RLS: user modified role grant';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    update public.permissions
    set description = 'forged'
    where code = 'school.student.read';
    RAISE EXCEPTION 'F1 RLS: user modified permission catalog';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$$;

RESET ROLE;
ROLLBACK;
