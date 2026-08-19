-- Task 3 — Module Plateforme + Documents + Fichiers
-- Vérifie les conditions de fichier et l'audit de synchronisation.

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
  v_user_id uuid := gen_random_uuid();
  v_profile_id uuid;
  v_role_id uuid;
  v_count integer;
BEGIN
  INSERT INTO public.school (code, name)
  VALUES ('qa-platform-' || extract(epoch from now())::text, 'QA Platform School')
  RETURNING id INTO v_school_id;

  INSERT INTO public.profiles (auth_user_id, school_id, display_name)
  VALUES (v_user_id, v_school_id, 'qa-platform-user')
  RETURNING id INTO v_profile_id;

  INSERT INTO public.roles (code, label)
  VALUES ('qa_platform_user', 'QA Platform User')
  ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label
  RETURNING id INTO v_role_id;

  INSERT INTO public.permissions (code, description)
  VALUES
    ('file.upload', 'Téléverser un fichier'),
    ('sync.submit', 'Soumettre une synchronisation')
  ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

  INSERT INTO public.role_permission_grants (role_id, permission_id, allowed)
  SELECT v_role_id, id, true
  FROM public.permissions
  WHERE code IN ('file.upload', 'sync.submit')
  ON CONFLICT (role_id, permission_id) DO UPDATE SET allowed = EXCLUDED.allowed;

  INSERT INTO public.profile_roles (profile_id, role_id)
  VALUES (v_profile_id, v_role_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.scope_assignments (profile_id, scope_type, scope_id)
  VALUES (v_profile_id, 'school', NULL)
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- file.upload avec condition type/taille valides
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_id)::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  ASSERT public.has_permission('file.upload') = true, 'utilisateur devrait avoir file.upload';

  -- Condition type valide
  PERFORM set_config('app.condition_file_type_valid', 'false', true);
  ASSERT pg_temp.has_condition('file_type_valid', '{"mime": "image/png"}'::jsonb) = false, 'le type de fichier devrait être invalide';

  PERFORM set_config('app.condition_file_type_valid', 'true', true);
  ASSERT pg_temp.has_condition('file_type_valid', '{"mime": "image/png"}'::jsonb) = true, 'le type de fichier devrait être valide';

  -- Condition taille valide
  PERFORM set_config('app.condition_file_size_valid', 'false', true);
  ASSERT pg_temp.has_condition('file_size_valid', '{"size": 10485760}'::jsonb) = false, 'la taille de fichier devrait être invalide';

  PERFORM set_config('app.condition_file_size_valid', 'true', true);
  ASSERT pg_temp.has_condition('file_size_valid', '{"size": 1048576}'::jsonb) = true, 'la taille de fichier devrait être valide';

  EXECUTE 'RESET ROLE';

  -- ============================================================
  -- sync.submit avec audit
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_id)::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  ASSERT public.has_permission('sync.submit') = true, 'utilisateur devrait avoir sync.submit';

  INSERT INTO public.audit_events (school_id, actor_profile_id, event_type, payload)
  VALUES (v_school_id, v_profile_id, 'sync.submit', '{"device": "qa-device", "records": 12}'::jsonb);

  SELECT count(*) INTO v_count FROM public.audit_events WHERE school_id = v_school_id AND event_type = 'sync.submit';
  ASSERT v_count = 1, 'l''événement d''audit sync.submit devrait être inséré';

  EXECUTE 'RESET ROLE';

  -- Nettoyage
  DELETE FROM public.audit_events WHERE school_id = v_school_id;
  DELETE FROM public.scope_assignments WHERE profile_id = v_profile_id;
  DELETE FROM public.profile_roles WHERE profile_id = v_profile_id;
  DELETE FROM public.profiles WHERE school_id = v_school_id;
  DELETE FROM public.school WHERE id = v_school_id;
  DELETE FROM public.role_permission_grants WHERE role_id = v_role_id;
  DELETE FROM public.permissions WHERE code IN ('file.upload', 'sync.submit');
  DELETE FROM public.roles WHERE id = v_role_id;
END $$;

COMMIT;
