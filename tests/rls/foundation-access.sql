BEGIN;

DO $$
DECLARE
  required_table text;
BEGIN
  FOREACH required_table IN ARRAY ARRAY[
    'school',
    'school_settings',
    'profiles',
    'devices',
    'roles',
    'permissions',
    'profile_roles',
    'role_permission_grants',
    'scope_assignments',
    'audit_events'
  ]
  LOOP
    IF to_regclass('public.' || required_table) IS NULL THEN
      RAISE EXCEPTION 'F1 RED: required table public.% is missing', required_table;
    END IF;
  END LOOP;
END
$$;

SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM 1 FROM public.school LIMIT 1;
    RAISE EXCEPTION 'F1 access failure: anon unexpectedly read public.school';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
END
$$;
RESET ROLE;

-- Synthetic identities used only inside this rolled-back test transaction.
insert into auth.users (
  id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('40000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'teacher-f1@test.local', now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('40000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'parent-f1@test.local', now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, auth_user_id, school_id, display_name) values
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Teacher F1'),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Parent F1');

insert into public.profile_roles (profile_id, role_id) values
  ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004'),
  ('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000007');

insert into public.role_permission_grants (role_id, permission_id, allowed)
values ('20000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000003', true);

select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF public.current_profile_id() IS DISTINCT FROM '50000000-0000-0000-0000-000000000001'::uuid THEN
    RAISE EXCEPTION 'F1 access failure: current_profile_id did not resolve teacher';
  END IF;
  IF public.has_permission('school.student.read') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'F1 access failure: teacher grant not resolved';
  END IF;
END
$$;
RESET ROLE;

select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000002', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF public.has_permission('school.student.read') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'F1 access failure: parent gained permission without grant';
  END IF;
END
$$;
RESET ROLE;

ROLLBACK;
