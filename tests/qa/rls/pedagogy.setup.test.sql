-- Task 3 — Module Pédagogie + Palmarès
-- Vérifie les permissions et conditions de gestion des cotes et devoirs.

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
  v_teacher_user uuid := gen_random_uuid();
  v_other_teacher_user uuid := gen_random_uuid();
  v_teacher_profile uuid;
  v_other_teacher_profile uuid;
  v_teacher_role uuid;
  v_year_id uuid;
  v_class_id uuid := gen_random_uuid();
  v_other_class_id uuid := gen_random_uuid();
  v_subject_id uuid;
  v_assignment_id uuid;
  v_student_id uuid := gen_random_uuid();
  v_grade_id uuid;
  v_count integer;
BEGIN
  INSERT INTO public.school (code, name)
  VALUES ('qa-pedagogy-' || extract(epoch from now())::text, 'QA Pedagogy School')
  RETURNING id INTO v_school_id;

  INSERT INTO public.profiles (auth_user_id, school_id, display_name)
  VALUES (v_teacher_user, v_school_id, 'qa-teacher')
  RETURNING id INTO v_teacher_profile;

  INSERT INTO public.profiles (auth_user_id, school_id, display_name)
  VALUES (v_other_teacher_user, v_school_id, 'qa-other-teacher')
  RETURNING id INTO v_other_teacher_profile;

  INSERT INTO public.roles (code, label)
  VALUES ('qa_teacher', 'QA Teacher')
  ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label
  RETURNING id INTO v_teacher_role;

  INSERT INTO public.permissions (code, description)
  VALUES
    ('pedagogy.grade.manage', 'Gérer les cotes'),
    ('pedagogy.assignment.manage', 'Gérer les devoirs')
  ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

  INSERT INTO public.role_permission_grants (role_id, permission_id, allowed)
  SELECT v_teacher_role, id, true
  FROM public.permissions
  WHERE code LIKE 'pedagogy.%'
  ON CONFLICT (role_id, permission_id) DO UPDATE SET allowed = EXCLUDED.allowed;

  INSERT INTO public.profile_roles (profile_id, role_id)
  VALUES
    (v_teacher_profile, v_teacher_role),
    (v_other_teacher_profile, v_teacher_role)
  ON CONFLICT DO NOTHING;

  -- Données métier
  INSERT INTO public.academic_years (school_id, label, starts_on, ends_on, periods)
  VALUES (v_school_id, '2025-2026', '2025-09-01', '2026-06-30', 'Trimestres')
  RETURNING id INTO v_year_id;

  INSERT INTO public.classes (id, school_id, academic_year_id, cycle_key, name)
  VALUES
    (v_class_id, v_school_id, v_year_id, 'primary', 'QA Pedagogy Class'),
    (v_other_class_id, v_school_id, v_year_id, 'primary', 'QA Other Class');

  INSERT INTO public.subjects (school_id, academic_year_id, cycle_key, code, name, language)
  VALUES (v_school_id, v_year_id, 'primary', 'MATH', 'Mathématiques', 'FR')
  RETURNING id INTO v_subject_id;

  -- Portées : l'enseignant est assigné à une classe et à une matière
  INSERT INTO public.scope_assignments (profile_id, scope_type, scope_id)
  VALUES
    (v_teacher_profile, 'assigned_classes', v_class_id),
    (v_teacher_profile, 'assigned_subjects', v_subject_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.teacher_assignments (school_id, academic_year_id, class_id, subject_id, teacher_id)
  VALUES (v_school_id, v_year_id, v_class_id, v_subject_id, v_teacher_profile);

  INSERT INTO public.students (id, school_id, class_id, matricule, first_name, last_name)
  VALUES (v_student_id, v_school_id, v_class_id, 'QA-PED-001', 'Eva', 'Test');

  INSERT INTO public.assignments (id, school_id, academic_year_id, class_id, subject_id, teacher_id, title, type, language, status)
  VALUES (gen_random_uuid(), v_school_id, v_year_id, v_class_id, v_subject_id, v_teacher_profile, 'Devoir 1', 'homework', 'FR', 'draft')
  RETURNING id INTO v_assignment_id;

  INSERT INTO public.grades (id, school_id, assignment_id, student_id, value_numeric, status, created_by)
  VALUES (gen_random_uuid(), v_school_id, v_assignment_id, v_student_id, 14.0, 'draft', v_teacher_profile)
  RETURNING id INTO v_grade_id;

  -- ============================================================
  -- Enseignant : pedagogy.grade.manage avec conditions
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_teacher_user)::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  ASSERT public.has_permission('pedagogy.grade.manage') = true, 'enseignant devrait avoir pedagogy.grade.manage';

  -- Condition période active
  PERFORM set_config('app.condition_active_period', 'false', true);
  ASSERT pg_temp.has_condition('active_period', '{}'::jsonb) = false, 'la période ne devrait pas être active';

  PERFORM set_config('app.condition_active_period', 'true', true);
  ASSERT pg_temp.has_condition('active_period', '{}'::jsonb) = true, 'la période devrait être active';

  -- Condition statut brouillon
  PERFORM set_config('app.condition_grade_status_draft', 'false', true);
  ASSERT pg_temp.has_condition('grade_status_draft', '{}'::jsonb) = false, 'la cote ne devrait pas être en brouillon';

  PERFORM set_config('app.condition_grade_status_draft', 'true', true);
  ASSERT pg_temp.has_condition('grade_status_draft', '{}'::jsonb) = true, 'la cote devrait être en brouillon';

  EXECUTE 'RESET ROLE';

  -- ============================================================
  -- Enseignant : pedagogy.assignment.manage avec portées
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_teacher_user)::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  ASSERT public.has_permission('pedagogy.assignment.manage') = true, 'enseignant devrait avoir pedagogy.assignment.manage';
  ASSERT public.has_scope('assigned_classes', v_class_id) = true, 'enseignant devrait avoir la classe assignée';
  ASSERT public.has_scope('assigned_subjects', v_subject_id) = true, 'enseignant devrait avoir la matière assignée';

  -- RLS : l'enseignant voit tous les devoirs de son école (écart attendu si has_scope n'est pas appliqué)
  SELECT count(*) INTO v_count FROM public.assignments WHERE school_id = v_school_id;
  ASSERT v_count = 1, 'enseignant devrait voir son devoir assigné';

  EXECUTE 'RESET ROLE';

  -- ============================================================
  -- Autre enseignant : ne doit pas voir/modifier le devoir d'un collègue
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_other_teacher_user)::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  ASSERT public.has_permission('pedagogy.assignment.manage') = true, 'autre enseignant devrait aussi avoir pedagogy.assignment.manage';
  ASSERT public.has_scope('assigned_classes', v_class_id) = false, 'autre enseignant ne devrait pas avoir la classe assignée';

  -- RLS : l'autre enseignant ne devrait pas voir le devoir (écart attendu)
  SELECT count(*) INTO v_count FROM public.assignments WHERE school_id = v_school_id;
  ASSERT v_count = 0, 'un enseignant non assigné ne devrait pas voir le devoir';

  EXECUTE 'RESET ROLE';

  -- Nettoyage
  DELETE FROM public.grades WHERE school_id = v_school_id;
  DELETE FROM public.assignment_questions WHERE assignment_id = v_assignment_id;
  DELETE FROM public.assignments WHERE school_id = v_school_id;
  DELETE FROM public.teacher_assignments WHERE school_id = v_school_id;
  DELETE FROM public.lesson_plans WHERE school_id = v_school_id;
  DELETE FROM public.subjects WHERE school_id = v_school_id;
  DELETE FROM public.students WHERE school_id = v_school_id;
  DELETE FROM public.classes WHERE school_id = v_school_id;
  DELETE FROM public.academic_years WHERE school_id = v_school_id;
  DELETE FROM public.scope_assignments WHERE profile_id IN (v_teacher_profile, v_other_teacher_profile);
  DELETE FROM public.profile_roles WHERE profile_id IN (v_teacher_profile, v_other_teacher_profile);
  DELETE FROM public.profiles WHERE school_id = v_school_id;
  DELETE FROM public.school WHERE id = v_school_id;
  DELETE FROM public.role_permission_grants WHERE role_id = v_teacher_role;
  DELETE FROM public.permissions WHERE code LIKE 'pedagogy.%';
  DELETE FROM public.roles WHERE id = v_teacher_role;
END $$;

COMMIT;
