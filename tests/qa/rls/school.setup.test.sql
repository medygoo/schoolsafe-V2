-- Task 3 — Module École
-- Vérifie la chaîne USER → SCHOOL → ROLE → PERMISSION → SCOPE pour la gestion scolaire.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.has_condition(p_condition text, p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_value text;
BEGIN
  v_value := current_setting('app.condition_' || p_condition, true);
  RETURN COALESCE(v_value, 'false')::boolean;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

DO $$
DECLARE
  v_school_id uuid;
  v_other_school_id uuid;
  v_admin_user uuid := gen_random_uuid();
  v_teacher_user uuid := gen_random_uuid();
  v_parent_user uuid := gen_random_uuid();
  v_admin_profile uuid;
  v_teacher_profile uuid;
  v_parent_profile uuid;
  v_role_id uuid;
  v_perm_id uuid;
  v_class_a uuid := gen_random_uuid();
  v_class_b uuid := gen_random_uuid();
  v_student_a uuid := gen_random_uuid();
  v_student_b uuid := gen_random_uuid();
  v_guardian_a uuid;
  v_count integer;
BEGIN
  -- Écoles
  INSERT INTO public.school (code, name)
  VALUES ('qa-school-' || extract(epoch from now())::text, 'QA School')
  RETURNING id INTO v_school_id;

  INSERT INTO public.school (code, name)
  VALUES ('qa-school-other-' || extract(epoch from now())::text, 'QA Other School')
  RETURNING id INTO v_other_school_id;

  -- Profils
  INSERT INTO public.profiles (auth_user_id, school_id, display_name)
  VALUES (v_admin_user, v_school_id, 'qa-school-admin')
  RETURNING id INTO v_admin_profile;

  INSERT INTO public.profiles (auth_user_id, school_id, display_name)
  VALUES (v_teacher_user, v_school_id, 'qa-school-teacher')
  RETURNING id INTO v_teacher_profile;

  INSERT INTO public.profiles (auth_user_id, school_id, display_name)
  VALUES (v_parent_user, v_school_id, 'qa-school-parent')
  RETURNING id INTO v_parent_profile;

  -- Rôle unique pour les tests scolaires
  INSERT INTO public.roles (code, label)
  VALUES ('qa_school_test', 'QA School Test')
  ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label
  RETURNING id INTO v_role_id;

  -- Permissions du module École
  INSERT INTO public.permissions (code, description)
  VALUES
    ('school.class.read', 'Lire les classes'),
    ('school.student.read', 'Lire les élèves'),
    ('school.guardian.read', 'Lire les tuteurs'),
    ('school.guardian.manage', 'Gérer les tuteurs'),
    ('school.manage', 'Gérer l''école'),
    ('staff.manage', 'Gérer le personnel'),
    ('roles.manage', 'Gérer les rôles')
  ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

  -- Attribution de toutes les permissions scolaires au rôle de test
  INSERT INTO public.role_permission_grants (role_id, permission_id, allowed)
  SELECT v_role_id, id, true
  FROM public.permissions
  WHERE code LIKE 'school.%' OR code IN ('staff.manage', 'roles.manage')
  ON CONFLICT (role_id, permission_id) DO UPDATE SET allowed = EXCLUDED.allowed;

  -- Assignation des rôles
  INSERT INTO public.profile_roles (profile_id, role_id)
  VALUES
    (v_admin_profile, v_role_id),
    (v_teacher_profile, v_role_id),
    (v_parent_profile, v_role_id)
  ON CONFLICT DO NOTHING;

  -- Portées
  INSERT INTO public.scope_assignments (profile_id, scope_type, scope_id)
  VALUES
    (v_admin_profile, 'school', NULL),
    (v_teacher_profile, 'assigned_classes', v_class_a),
    (v_parent_profile, 'own_children', v_student_a)
  ON CONFLICT DO NOTHING;

  -- Données métier : classes, élèves, tuteurs
  INSERT INTO public.classes (id, school_id, cycle_key, name)
  VALUES
    (v_class_a, v_school_id, 'primary', 'QA Classe A'),
    (v_class_b, v_school_id, 'primary', 'QA Classe B');

  INSERT INTO public.students (id, school_id, class_id, matricule, first_name, last_name)
  VALUES
    (v_student_a, v_school_id, v_class_a, 'QA-001', 'Alice', 'Test'),
    (v_student_b, v_school_id, v_class_b, 'QA-002', 'Bob', 'Test');

  INSERT INTO public.student_guardians (student_id, guardian_type, full_name)
  VALUES (v_student_a, 'mere', 'Mère Alice')
  RETURNING id INTO v_guardian_a;

  -- ============================================================
  -- Tests Admin : portée school
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_user)::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  ASSERT public.has_permission('school.class.read') = true, 'admin devrait avoir school.class.read';
  ASSERT public.has_permission('school.manage') = true, 'admin devrait avoir school.manage';
  ASSERT public.has_scope('school', NULL) = true, 'admin devrait avoir la portée school';
  ASSERT public.has_scope('assigned_classes', v_class_a) = false, 'admin n''a pas la portée assigned_classes';

  -- RLS : admin voit toutes les classes de son école
  SELECT count(*) INTO v_count FROM public.classes WHERE school_id = v_school_id;
  ASSERT v_count = 2, 'admin devrait voir les 2 classes de son école';

  -- RLS : admin ne voit pas l'autre école
  SELECT count(*) INTO v_count FROM public.classes WHERE school_id = v_other_school_id;
  ASSERT v_count = 0, 'admin ne devrait pas voir les classes de l''autre école';

  EXECUTE 'RESET ROLE';

  -- ============================================================
  -- Tests Enseignant : portée assigned_classes
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_teacher_user)::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  ASSERT public.has_permission('school.class.read') = true, 'enseignant devrait avoir school.class.read';
  ASSERT public.has_scope('assigned_classes', v_class_a) = true, 'enseignant devrait avoir la classe A';
  ASSERT public.has_scope('assigned_classes', v_class_b) = false, 'enseignant ne devrait pas avoir la classe B';

  -- RLS : l'enseignant devrait seulement voir la classe assignée (écart attendu si la policy n'utilise pas has_scope)
  SELECT count(*) INTO v_count FROM public.classes WHERE school_id = v_school_id;
  ASSERT v_count = 1, 'enseignant ne devrait voir que sa classe assignée';

  EXECUTE 'RESET ROLE';

  -- ============================================================
  -- Tests Parent : portée own_children
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_parent_user)::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  ASSERT public.has_permission('school.student.read') = true, 'parent devrait avoir school.student.read';
  ASSERT public.has_permission('school.guardian.read') = true, 'parent devrait avoir school.guardian.read';
  ASSERT public.has_scope('own_children', v_student_a) = true, 'parent devrait avoir son enfant A';
  ASSERT public.has_scope('own_children', v_student_b) = false, 'parent ne devrait pas avoir l''enfant B';

  -- RLS : le parent devrait seulement voir son propre enfant (écart attendu)
  SELECT count(*) INTO v_count FROM public.students WHERE school_id = v_school_id;
  ASSERT v_count = 1, 'parent ne devrait voir que son propre enfant';

  SELECT count(*) INTO v_count FROM public.student_guardians
  WHERE student_id = v_student_a;
  ASSERT v_count = 1, 'parent devrait voir le tuteur de son enfant';

  EXECUTE 'RESET ROLE';

  -- ============================================================
  -- Audit : school.guardian.manage, school.manage, staff.manage, roles.manage
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_user)::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  ASSERT public.has_permission('school.guardian.manage') = true, 'admin devrait avoir school.guardian.manage';
  ASSERT public.has_permission('staff.manage') = true, 'admin devrait avoir staff.manage';
  ASSERT public.has_permission('roles.manage') = true, 'admin devrait avoir roles.manage';

  -- Les actions de gestion doivent générer un audit (simulation : l'insertion est autorisée par RLS)
  INSERT INTO public.audit_events (school_id, actor_profile_id, event_type, payload)
  VALUES (v_school_id, v_admin_profile, 'role.permission.granted', '{"test": true}'::jsonb);

  SELECT count(*) INTO v_count FROM public.audit_events WHERE school_id = v_school_id;
  ASSERT v_count = 1, 'l''événement d''audit devrait être inséré';

  EXECUTE 'RESET ROLE';

  -- Nettoyage
  DELETE FROM public.audit_events WHERE school_id = v_school_id;
  DELETE FROM public.student_guardians WHERE id = v_guardian_a;
  DELETE FROM public.students WHERE school_id = v_school_id;
  DELETE FROM public.classes WHERE school_id = v_school_id;
  DELETE FROM public.scope_assignments WHERE profile_id IN (v_admin_profile, v_teacher_profile, v_parent_profile);
  DELETE FROM public.profile_roles WHERE profile_id IN (v_admin_profile, v_teacher_profile, v_parent_profile);
  DELETE FROM public.profiles WHERE school_id IN (v_school_id, v_other_school_id);
  DELETE FROM public.school WHERE id IN (v_school_id, v_other_school_id);
  DELETE FROM public.role_permission_grants WHERE role_id = v_role_id;
  DELETE FROM public.permissions WHERE code LIKE 'school.%' OR code IN ('staff.manage', 'roles.manage');
  DELETE FROM public.roles WHERE id = v_role_id;
END $$;

COMMIT;
