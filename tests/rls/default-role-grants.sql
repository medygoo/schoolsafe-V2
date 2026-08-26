BEGIN;

-- Synthetic identities used only inside this rolled-back test transaction.
insert into auth.users (
  id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('42000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin-grants@test.local', now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('42000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'parent-grants@test.local', now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('42000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'teacher-grants@test.local', now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);

insert into public.profiles (id, auth_user_id, school_id, display_name) values
  ('52000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Admin Grants'),
  ('52000000-0000-0000-0000-000000000002', '42000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Parent Grants'),
  ('52000000-0000-0000-0000-000000000003', '42000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Teacher Grants');

insert into public.profile_roles (profile_id, role_id) values
  ('52000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001'),
  ('52000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000007'),
  ('52000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000004');

-- Admin : toutes les permissions du catalogue via le rôle admin.
select set_config('request.jwt.claim.sub', '42000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF public.current_profile_id() IS DISTINCT FROM '52000000-0000-0000-0000-000000000001'::uuid THEN
    RAISE EXCEPTION 'default-role-grants failure: current_profile_id did not resolve admin';
  END IF;
  IF public.has_permission('school.manage') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'default-role-grants failure: admin missing school.manage';
  END IF;
  IF public.has_permission('cards.request.print') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'default-role-grants failure: admin missing cards.request.print';
  END IF;
END
$$;
RESET ROLE;

-- Exception DENY active sur l'admin : doit l'emporter sur le grant du rôle.
insert into public.profile_permission_exceptions (profile_id, permission_code, allowed, reason, granted_by)
values ('52000000-0000-0000-0000-000000000001', 'school.manage', false, 'Test DENY exception', '52000000-0000-0000-0000-000000000001');

SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF public.has_permission('school.manage') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'default-role-grants failure: DENY exception did not override admin grant';
  END IF;
END
$$;
RESET ROLE;

-- Parent : reçus autorisés, administration de l'école refusée.
select set_config('request.jwt.claim.sub', '42000000-0000-0000-0000-000000000002', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF public.has_permission('finance.receipt.read') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'default-role-grants failure: parent missing finance.receipt.read';
  END IF;
  IF public.has_permission('school.manage') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'default-role-grants failure: parent gained school.manage without grant';
  END IF;
END
$$;
RESET ROLE;

-- Teacher : pas d'accès à l'enregistrement des paiements.
select set_config('request.jwt.claim.sub', '42000000-0000-0000-0000-000000000003', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF public.has_permission('finance.payment.record') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'default-role-grants failure: teacher gained finance.payment.record without grant';
  END IF;
END
$$;
RESET ROLE;

ROLLBACK;
