-- Task 3 — Module Auth & setup
-- Vérifie que le bootstrap de session et l'isolement école sont actifs au niveau RLS.

BEGIN;

-- Fonction temporaire pour simuler les conditions jusqu'à l'implémentation de has_condition().
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

-- Données de test
DO $$
DECLARE
  v_school_id uuid;
  v_auth_user_id uuid := gen_random_uuid();
  v_other_auth_user_id uuid := gen_random_uuid();
  v_profile_id uuid;
  v_role_id uuid;
  v_perm_id uuid;
  v_count integer;
BEGIN
  -- École et profil admin
  INSERT INTO public.school (code, name)
  VALUES ('qa-auth-' || extract(epoch from now())::text, 'QA Auth School')
  RETURNING id INTO v_school_id;

  INSERT INTO public.profiles (auth_user_id, school_id, display_name, is_active)
  VALUES (v_auth_user_id, v_school_id, 'qa-admin', true)
  RETURNING id INTO v_profile_id;

  -- Rôle et permission session.bootstrap
  INSERT INTO public.roles (code, label)
  VALUES ('qa_admin', 'QA Admin')
  ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label
  RETURNING id INTO v_role_id;

  INSERT INTO public.permissions (code, description)
  VALUES ('session.bootstrap', 'Bootstrap de session valide')
  ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description
  RETURNING id INTO v_perm_id;

  INSERT INTO public.role_permission_grants (role_id, permission_id, allowed)
  VALUES (v_role_id, v_perm_id, true)
  ON CONFLICT (role_id, permission_id) DO UPDATE SET allowed = EXCLUDED.allowed;

  INSERT INTO public.profile_roles (profile_id, role_id)
  VALUES (v_profile_id, v_role_id)
  ON CONFLICT DO NOTHING;

  -- Autre école pour tester l'isolement
  INSERT INTO public.school (code, name)
  VALUES ('qa-auth-other-' || extract(epoch from now())::text, 'QA Auth Other School');

  -- Simulation condition token setup valide
  PERFORM set_config('app.condition_token_setup_valid', 'true', true);

  -- Contexte authentifié
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_auth_user_id)::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- L'utilisateur authentifié peut résoudre son profil et son école
  ASSERT public.current_profile_id() = v_profile_id, 'current_profile_id doit retourner le profil authentifié';
  ASSERT public.current_school_id() = v_school_id, 'current_school_id doit retourner l''école du profil';

  -- La permission session.bootstrap est accordée
  ASSERT public.has_permission('session.bootstrap') = true, 'admin devrait avoir session.bootstrap';

  -- La condition token setup valide est simulée comme vraie
  ASSERT pg_temp.has_condition('token_setup_valid', '{}'::jsonb) = true, 'la condition token_setup_valid devrait être vraie';

  -- RLS : l'utilisateur ne voit que sa propre école
  SELECT count(*) INTO v_count FROM public.school WHERE id = v_school_id;
  ASSERT v_count = 1, 'l''utilisateur devrait voir son école';

  SELECT count(*) INTO v_count FROM public.school WHERE code LIKE 'qa-auth-other-%';
  ASSERT v_count = 0, 'l''utilisateur ne devrait pas voir l''autre école';

  -- Contexte sans profil : current_profile_id est NULL
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_other_auth_user_id)::text, true);
  ASSERT public.current_profile_id() IS NULL, 'un auth_user sans profil ne doit pas avoir de current_profile_id';
  ASSERT public.has_permission('session.bootstrap') = false, 'un auth_user sans profil ne doit pas avoir session.bootstrap';

  -- Nettoyage explicite dans la transaction avant le commit
  EXECUTE 'RESET ROLE';
  DELETE FROM public.profile_roles WHERE profile_id = v_profile_id;
  DELETE FROM public.role_permission_grants WHERE role_id = v_role_id;
  DELETE FROM public.profiles WHERE school_id = v_school_id;
  DELETE FROM public.school WHERE id = v_school_id OR code LIKE 'qa-auth-other-%';
  DELETE FROM public.roles WHERE id = v_role_id;
  DELETE FROM public.permissions WHERE id = v_perm_id;
END $$;

COMMIT;
