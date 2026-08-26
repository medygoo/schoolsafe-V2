BEGIN;

DO $$
DECLARE
  required_table text;
BEGIN
  FOREACH required_table IN ARRAY ARRAY[
    'student_enrollments',
    'student_enrollment_events',
    'parent_invitations'
  ] LOOP
    IF to_regclass('public.' || required_table) IS NULL THEN
      RAISE EXCEPTION 'B1 RED: required table public.% is missing', required_table;
    END IF;
  END LOOP;
END
$$;

insert into public.school (id, code, name) values
  ('11000000-0000-0000-0000-000000000001', 'b1-school-a', 'B1 School A'),
  ('11000000-0000-0000-0000-000000000002', 'b1-school-b', 'B1 School B');

insert into auth.users (
  id, aud, role, email, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('41000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin-b1@test.local', now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('41000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'teacher-b1@test.local', now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('41000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'parent-b1@test.local', now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('41000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'other-parent-b1@test.local', now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('41000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'norole-b1@test.local', now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);

insert into public.profiles (
  id, auth_user_id, school_id, display_name, first_name, last_name, email, account_status
) values
  ('51000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'Admin B1', 'Admin', 'B1', 'admin-b1@test.local', 'active'),
  ('51000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000001', 'Teacher B1', 'Teacher', 'B1', 'teacher-b1@test.local', 'active'),
  ('51000000-0000-0000-0000-000000000003', '41000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000001', 'Parent B1', 'Parent', 'B1', 'parent-b1@test.local', 'active'),
  ('51000000-0000-0000-0000-000000000004', '41000000-0000-0000-0000-000000000004', '11000000-0000-0000-0000-000000000002', 'Other Parent B1', 'Other', 'Parent', 'other-parent-b1@test.local', 'active'),
  ('51000000-0000-0000-0000-000000000005', '41000000-0000-0000-0000-000000000005', '11000000-0000-0000-0000-000000000001', 'No Role B1', 'No', 'Role', 'norole-b1@test.local', 'active');

insert into public.profile_roles (profile_id, role_id) values
  ('51000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001'),
  ('51000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000004'),
  ('51000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000007'),
  ('51000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000007');

insert into public.academic_years (id, school_id, label, starts_on, ends_on, periods, is_active) values
  ('71000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', '2026-2027', '2026-09-01', '2027-06-30', 'Trimestres', true),
  ('71000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000002', '2026-2027', '2026-09-01', '2027-06-30', 'Trimestres', true);

insert into public.classes (id, school_id, academic_year_id, cycle_key, name) values
  ('81000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'primary', 'B1 Classe A'),
  ('81000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'primary', 'B1 Classe B');

insert into public.teacher_assignments (school_id, academic_year_id, class_id, teacher_id, is_tutor)
values ('11000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000002', true);

insert into public.scope_assignments (profile_id, scope_type, scope_id) values
  ('51000000-0000-0000-0000-000000000002', 'assigned_classes', '81000000-0000-0000-0000-000000000001');

-- Un élève historique reste actif et reçoit automatiquement son inscription héritée.
insert into public.students (
  id, school_id, class_id, matricule, first_name, last_name, lifecycle_status
) values (
  '61000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001',
  '81000000-0000-0000-0000-000000000001', 'B1-HIST-001', 'Historique', 'Actif', 'active'
);

DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.student_enrollments
  WHERE student_id = '61000000-0000-0000-0000-000000000001'
    AND status = 'active'
    AND class_id = '81000000-0000-0000-0000-000000000001';
  IF v_count <> 1 THEN RAISE EXCEPTION 'B1: inherited active enrollment was not created'; END IF;
  IF public.is_student_operational('61000000-0000-0000-0000-000000000001') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'B1: historical student should remain operational';
  END IF;
END
$$;

insert into public.student_guardians (
  school_id, student_id, profile_id, guardian_type, is_primary, full_name, is_authorized_pickup
) values (
  '11000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001',
  '51000000-0000-0000-0000-000000000003', 'mere', true, 'Parent B1', false
);

-- Permission dédiée : admin ALLOW, autres rôles sans ALLOW par défaut.
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF public.has_permission('school.student.create') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'B1: admin missing school.student.create';
  END IF;
END
$$;
RESET ROLE;

select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000002', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF public.has_permission('school.student.create') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'B1: teacher gained school.student.create by default';
  END IF;
END
$$;
RESET ROLE;

-- DENY explicite prioritaire sur l'ALLOW admin.
insert into public.profile_permission_exceptions (profile_id, permission_code, allowed, reason, granted_by)
values ('51000000-0000-0000-0000-000000000001', 'school.student.create', false, 'B1 explicit deny', '51000000-0000-0000-0000-000000000001');
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF public.has_permission('school.student.create') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'B1: explicit DENY did not override ALLOW';
  END IF;
END
$$;
RESET ROLE;
delete from public.profile_permission_exceptions
where profile_id = '51000000-0000-0000-0000-000000000001' and permission_code = 'school.student.create';

-- Création atomique avec parent existant.
DO $$
DECLARE
  v_result jsonb;
  v_student_id uuid;
BEGIN
  v_result := public.create_student_draft(
    '11000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001',
    'B1-DRAFT-001', 'Amina', 'Grâce', 'Mbuyi', '2015-04-03', 'F',
    '71000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000002', '2026-09-01',
    'mere', '51000000-0000-0000-0000-000000000003', null, null, null, null, null
  );
  v_student_id := (v_result->>'id')::uuid;
  IF v_result->>'lifecycle_status' <> 'draft' OR v_result->>'class_id' IS NOT NULL THEN
    RAISE EXCEPTION 'B1: created student is not an unprojected draft';
  END IF;
  IF public.is_student_operational(v_student_id) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'B1: draft unexpectedly operational';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.student_enrollments WHERE student_id = v_student_id AND status = 'draft') THEN
    RAISE EXCEPTION 'B1: draft enrollment missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.student_guardians WHERE student_id = v_student_id AND profile_id = '51000000-0000-0000-0000-000000000003' AND is_primary) THEN
    RAISE EXCEPTION 'B1: primary parent link missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.audit_events WHERE event_type = 'student.draft.created' AND payload->>'student_id' = v_student_id::text) THEN
    RAISE EXCEPTION 'B1: creation audit missing';
  END IF;
END
$$;

-- Doublon, parent d'une autre école et profil sans rôle Parent : aucune création partielle.
DO $$
DECLARE v_before integer; v_after integer;
BEGIN
  SELECT count(*) INTO v_before FROM public.students WHERE school_id = '11000000-0000-0000-0000-000000000001';
  BEGIN
    PERFORM public.create_student_draft(
      '11000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001',
      'B1-DRAFT-001', 'Duplicate', null, 'Student', null, null,
      '71000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000002', '2026-09-01',
      'mere', '51000000-0000-0000-0000-000000000003', null, null, null, null, null
    );
    RAISE EXCEPTION 'B1: duplicate matricule unexpectedly accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.create_student_draft(
      '11000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001',
      'B1-OTHER-PARENT', 'Other', null, 'School', null, null,
      '71000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000002', '2026-09-01',
      'pere', '51000000-0000-0000-0000-000000000004', null, null, null, null, null
    );
    RAISE EXCEPTION 'B1: other-school parent unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.create_student_draft(
      '11000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001',
      'B1-NOROLE-PARENT', 'No', null, 'Role', null, null,
      '71000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000002', '2026-09-01',
      'autre', '51000000-0000-0000-0000-000000000005', null, null, null, null, null
    );
    RAISE EXCEPTION 'B1: non-parent profile unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  SELECT count(*) INTO v_after FROM public.students WHERE school_id = '11000000-0000-0000-0000-000000000001';
  IF v_after <> v_before THEN RAISE EXCEPTION 'B1: failed creation left an orphan student'; END IF;
END
$$;

-- Parent invité : pending_activation, aucun auth user/mot de passe, token seulement haché, puis compensation complète.
DO $$
DECLARE
  v_result jsonb;
  v_student_id uuid;
  v_parent_id uuid;
  v_invitation_id uuid;
BEGIN
  v_result := public.create_student_draft(
    '11000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001',
    'B1-INVITED-001', 'Lina', null, 'Mbuyi', '2016-02-01', 'F',
    '71000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000002', '2026-09-01',
    'mere', null, 'invited-b1@test.local', 'Sarah', 'Mbuyi', '+243810000000', repeat('a', 64)
  );
  v_student_id := (v_result->>'id')::uuid;
  v_parent_id := (v_result->'parent'->>'id')::uuid;
  SELECT id INTO v_invitation_id FROM public.parent_invitations WHERE profile_id = v_parent_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_parent_id AND account_status = 'pending_activation' AND auth_user_id IS NULL
  ) THEN RAISE EXCEPTION 'B1: invited parent activation state invalid'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.parent_invitations
    WHERE id = v_invitation_id AND token_hash = repeat('a', 64) AND token_hash <> 'clear-token'
  ) THEN RAISE EXCEPTION 'B1: invitation hash missing'; END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name IN ('profiles', 'parent_invitations') AND column_name ILIKE '%password%'
  ) THEN RAISE EXCEPTION 'B1: school-owned password column detected'; END IF;

  PERFORM public.compensate_student_draft_creation(v_student_id, '51000000-0000-0000-0000-000000000001');
  IF EXISTS (SELECT 1 FROM public.students WHERE id = v_student_id)
    OR EXISTS (SELECT 1 FROM public.student_enrollments WHERE student_id = v_student_id)
    OR EXISTS (SELECT 1 FROM public.student_guardians WHERE student_id = v_student_id)
    OR EXISTS (SELECT 1 FROM public.parent_invitations WHERE id = v_invitation_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = v_parent_id)
  THEN RAISE EXCEPTION 'B1: compensation left orphan records'; END IF;
END
$$;

-- Les transitions et la projection class_id sont interdites en B1.
DO $$
DECLARE v_student_id uuid;
BEGIN
  SELECT id INTO v_student_id FROM public.students WHERE matricule = 'B1-DRAFT-001';
  BEGIN
    UPDATE public.students SET lifecycle_status = 'active' WHERE id = v_student_id;
    RAISE EXCEPTION 'B1: draft to active transition unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.students SET class_id = '81000000-0000-0000-0000-000000000002' WHERE id = v_student_id;
    RAISE EXCEPTION 'B1: direct class_id update unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.student_enrollments SET status = 'active' WHERE student_id = v_student_id;
    RAISE EXCEPTION 'B1: enrollment activation unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END
$$;

-- RLS : parent limité à son enfant actif, enseignant limité aux actifs de sa classe, école isolée.
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000003', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.students;
  IF v_count <> 1 THEN RAISE EXCEPTION 'B1: parent should see exactly one active child, got %', v_count; END IF;
END
$$;
RESET ROLE;

select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000002', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.students;
  IF v_count <> 1 THEN RAISE EXCEPTION 'B1: teacher should see exactly one active assigned student, got %', v_count; END IF;
END
$$;
RESET ROLE;

-- Les écritures des modules opérationnels refusent un draft au niveau central.
DO $$
DECLARE
  v_draft uuid;
  v_fee_structure uuid;
  v_subject uuid;
  v_assignment uuid;
  v_ranking uuid;
BEGIN
  SELECT id INTO v_draft FROM public.students WHERE matricule = 'B1-DRAFT-001';
  INSERT INTO public.fee_structures (school_id, academic_year_id, cycle_key, label, amount)
  VALUES ('11000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'primary', 'B1 Fees', 100)
  RETURNING id INTO v_fee_structure;
  INSERT INTO public.subjects (school_id, academic_year_id, cycle_key, code, name, language)
  VALUES ('11000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'primary', 'B1-MATH', 'B1 Math', 'FR')
  RETURNING id INTO v_subject;
  INSERT INTO public.assignments (school_id, academic_year_id, class_id, subject_id, teacher_id, title, type, language)
  VALUES ('11000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000002', v_subject, '51000000-0000-0000-0000-000000000002', 'B1 Assignment', 'homework', 'FR')
  RETURNING id INTO v_assignment;
  INSERT INTO public.rankings (school_id, class_id, month, computed_by_profile_id)
  VALUES ('11000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000002', '2026-09', '51000000-0000-0000-0000-000000000001')
  RETURNING id INTO v_ranking;

  BEGIN
    INSERT INTO public.card_print_requests (school_id, student_id, requested_by, format)
    VALUES ('11000000-0000-0000-0000-000000000001', v_draft, '51000000-0000-0000-0000-000000000001', 'carte');
    RAISE EXCEPTION 'B1: Cards consumed a draft';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.student_cards (school_id, student_id, card_number, card_secret, signature)
    VALUES ('11000000-0000-0000-0000-000000000001', v_draft, 'B1-DRAFT-CARD', 'secret', 'signature');
    RAISE EXCEPTION 'B1: Security card consumed a draft';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.security_events (school_id, student_id, event_type, scanned_by, decision)
    VALUES ('11000000-0000-0000-0000-000000000001', v_draft, 'entry', '51000000-0000-0000-0000-000000000001', 'allowed');
    RAISE EXCEPTION 'B1: Security event consumed a draft';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.student_fees (school_id, student_id, fee_structure_id, amount_expected, amount_remaining)
    VALUES ('11000000-0000-0000-0000-000000000001', v_draft, v_fee_structure, 100, 100);
    RAISE EXCEPTION 'B1: Finance consumed a draft';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.grades (school_id, assignment_id, student_id, value_numeric, created_by)
    VALUES ('11000000-0000-0000-0000-000000000001', v_assignment, v_draft, 10, '51000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'B1: Pedagogy consumed a draft';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.ranking_entries (ranking_id, student_id, rank, monthly_average)
    VALUES (v_ranking, v_draft, 1, 10);
    RAISE EXCEPTION 'B1: Rankings consumed a draft';
  EXCEPTION WHEN check_violation THEN NULL; END;
END
$$;

ROLLBACK;
