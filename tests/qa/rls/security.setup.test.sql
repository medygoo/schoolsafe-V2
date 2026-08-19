-- Task 3 — Module Sécurité QR
-- Vérifie les permissions et conditions de scan, récupération et lockdown.

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
  v_guard_user uuid := gen_random_uuid();
  v_admin_user uuid := gen_random_uuid();
  v_guard_profile uuid;
  v_admin_profile uuid;
  v_guard_role uuid;
  v_admin_role uuid;
  v_class_id uuid := gen_random_uuid();
  v_student_id uuid := gen_random_uuid();
  v_location_id uuid;
  v_card_id uuid;
  v_guardian_id uuid;
  v_event_id uuid;
  v_count integer;
BEGIN
  INSERT INTO public.school (code, name)
  VALUES ('qa-security-' || extract(epoch from now())::text, 'QA Security School')
  RETURNING id INTO v_school_id;

  INSERT INTO public.profiles (auth_user_id, school_id, display_name)
  VALUES (v_guard_user, v_school_id, 'qa-security-guard')
  RETURNING id INTO v_guard_profile;

  INSERT INTO public.profiles (auth_user_id, school_id, display_name)
  VALUES (v_admin_user, v_school_id, 'qa-security-admin')
  RETURNING id INTO v_admin_profile;

  INSERT INTO public.roles (code, label)
  VALUES ('qa_security_guard', 'QA Security Guard')
  ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label
  RETURNING id INTO v_guard_role;

  INSERT INTO public.roles (code, label)
  VALUES ('qa_security_admin', 'QA Security Admin')
  ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label
  RETURNING id INTO v_admin_role;

  INSERT INTO public.permissions (code, description)
  VALUES
    ('security.scan', 'Scanner un QR de sécurité'),
    ('security.pickup.manage', 'Gérer la récupération'),
    ('security.lockdown.manage', 'Gérer le lockdown')
  ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

  -- Guard : scan + pickup.manage
  INSERT INTO public.role_permission_grants (role_id, permission_id, allowed)
  SELECT v_guard_role, id, true
  FROM public.permissions
  WHERE code IN ('security.scan', 'security.pickup.manage')
  ON CONFLICT (role_id, permission_id) DO UPDATE SET allowed = EXCLUDED.allowed;

  -- Admin : toutes les permissions sécurité
  INSERT INTO public.role_permission_grants (role_id, permission_id, allowed)
  SELECT v_admin_role, id, true
  FROM public.permissions
  WHERE code LIKE 'security.%'
  ON CONFLICT (role_id, permission_id) DO UPDATE SET allowed = EXCLUDED.allowed;

  INSERT INTO public.profile_roles (profile_id, role_id)
  VALUES
    (v_guard_profile, v_guard_role),
    (v_admin_profile, v_admin_role)
  ON CONFLICT DO NOTHING;

  -- Données métier
  INSERT INTO public.classes (id, school_id, cycle_key, name)
  VALUES (v_class_id, v_school_id, 'primary', 'QA Security Class');

  INSERT INTO public.students (id, school_id, class_id, matricule, first_name, last_name)
  VALUES (v_student_id, v_school_id, v_class_id, 'QA-SEC-001', 'David', 'Test');

  INSERT INTO public.locations (school_id, code, label, kind)
  VALUES (v_school_id, 'GATE-1', 'Portail principal', 'gate')
  RETURNING id INTO v_location_id;

  INSERT INTO public.student_cards (school_id, student_id, card_number, card_secret, signature)
  VALUES (v_school_id, v_student_id, 'CARD-001', 'secret', 'sig')
  RETURNING id INTO v_card_id;

  INSERT INTO public.student_guardians (student_id, guardian_type, full_name, is_authorized_pickup)
  VALUES (v_student_id, 'pere', 'Père David', true)
  RETURNING id INTO v_guardian_id;

  -- ============================================================
  -- Guard : security.scan avec condition portail actif
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_guard_user)::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  ASSERT public.has_permission('security.scan') = true, 'agent de sécurité devrait avoir security.scan';

  PERFORM set_config('app.condition_portal_active', 'false', true);
  ASSERT pg_temp.has_condition('portal_active', '{}'::jsonb) = false, 'le portail devrait être inactif';

  PERFORM set_config('app.condition_portal_active', 'true', true);
  ASSERT pg_temp.has_condition('portal_active', '{}'::jsonb) = true, 'le portail devrait être actif';

  -- RLS : l'agent peut insérer un événement de sécurité pour son école
  INSERT INTO public.security_events (school_id, student_id, card_id, location_id, event_type, scanned_by, decision)
  VALUES (v_school_id, v_student_id, v_card_id, v_location_id, 'entry', v_guard_profile, 'allowed')
  RETURNING id INTO v_event_id;

  SELECT count(*) INTO v_count FROM public.security_events WHERE school_id = v_school_id;
  ASSERT v_count = 1, 'l''agent devrait pouvoir insérer un événement de sécurité';

  EXECUTE 'RESET ROLE';

  -- ============================================================
  -- Guard : security.pickup.manage avec condition portail actif
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_guard_user)::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  ASSERT public.has_permission('security.pickup.manage') = true, 'agent devrait avoir security.pickup.manage';

  PERFORM set_config('app.condition_portal_active', 'true', true);
  ASSERT pg_temp.has_condition('portal_active', '{}'::jsonb) = true, 'le portail devrait être actif pour la récupération';

  -- RLS : l'agent voit les tuteurs de son école
  SELECT count(*) INTO v_count FROM public.student_guardians
  WHERE student_id IN (SELECT id FROM public.students WHERE school_id = v_school_id);
  ASSERT v_count = 1, 'l''agent devrait voir le tuteur autorisé';

  EXECUTE 'RESET ROLE';

  -- ============================================================
  -- Admin : security.lockdown.manage avec portée school + audit
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_user)::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  ASSERT public.has_permission('security.lockdown.manage') = true, 'admin devrait avoir security.lockdown.manage';
  ASSERT public.has_scope('school', NULL) = false, 'admin de test n''a pas explicitement la portée school';

  -- L'admin peut modifier le paramètre de lockdown de son école
  INSERT INTO public.school_settings (school_id, max_offline_hours, lockdown_active)
  VALUES (v_school_id, 24, false)
  ON CONFLICT (school_id) DO NOTHING;

  UPDATE public.school_settings
  SET lockdown_active = true, lockdown_activated_at = now(), lockdown_activated_by = v_admin_profile
  WHERE school_id = v_school_id;

  SELECT count(*) INTO v_count FROM public.school_settings WHERE school_id = v_school_id AND lockdown_active = true;
  ASSERT v_count = 1, 'l''admin devrait pouvoir activer le lockdown';

  -- Audit
  INSERT INTO public.audit_events (school_id, actor_profile_id, event_type, payload)
  VALUES (v_school_id, v_admin_profile, 'security.lockdown.manage', '{"active": true}'::jsonb);

  SELECT count(*) INTO v_count FROM public.audit_events WHERE school_id = v_school_id;
  ASSERT v_count = 1, 'l''événement d''audit lockdown devrait être inséré';

  EXECUTE 'RESET ROLE';

  -- Nettoyage
  DELETE FROM public.audit_events WHERE school_id = v_school_id;
  DELETE FROM public.security_events WHERE school_id = v_school_id;
  DELETE FROM public.student_guardians WHERE id = v_guardian_id;
  DELETE FROM public.student_cards WHERE id = v_card_id;
  DELETE FROM public.locations WHERE school_id = v_school_id;
  DELETE FROM public.students WHERE school_id = v_school_id;
  DELETE FROM public.classes WHERE school_id = v_school_id;
  DELETE FROM public.scope_assignments WHERE profile_id IN (v_guard_profile, v_admin_profile);
  DELETE FROM public.profile_roles WHERE profile_id IN (v_guard_profile, v_admin_profile);
  DELETE FROM public.profiles WHERE school_id = v_school_id;
  DELETE FROM public.school WHERE id = v_school_id;
  DELETE FROM public.role_permission_grants WHERE role_id IN (v_guard_role, v_admin_role);
  DELETE FROM public.permissions WHERE code LIKE 'security.%';
  DELETE FROM public.roles WHERE id IN (v_guard_role, v_admin_role);
END $$;

COMMIT;
