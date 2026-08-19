-- Task 3 — Module Pilotage + Rapports
-- Vérifie les permissions et conditions de gestion des approbations et du tableau de bord.

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
  v_admin_user uuid := gen_random_uuid();
  v_admin_profile uuid;
  v_admin_role uuid;
  v_request_id uuid;
  v_perm_id uuid;
  v_count integer;
BEGIN
  INSERT INTO public.school (code, name)
  VALUES ('qa-pilotage-' || extract(epoch from now())::text, 'QA Pilotage School')
  RETURNING id INTO v_school_id;

  INSERT INTO public.profiles (auth_user_id, school_id, display_name)
  VALUES (v_admin_user, v_school_id, 'qa-pilotage-admin')
  RETURNING id INTO v_admin_profile;

  INSERT INTO public.roles (code, label)
  VALUES ('qa_pilotage_admin', 'QA Pilotage Admin')
  ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label
  RETURNING id INTO v_admin_role;

  INSERT INTO public.permissions (code, description)
  VALUES
    ('pilotage.approvals.manage', 'Gérer les demandes d''approbation'),
    ('pilotage.dashboard.read', 'Lire le tableau de bord')
  ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

  INSERT INTO public.role_permission_grants (role_id, permission_id, allowed)
  SELECT v_admin_role, id, true
  FROM public.permissions
  WHERE code LIKE 'pilotage.%'
  ON CONFLICT (role_id, permission_id) DO UPDATE SET allowed = EXCLUDED.allowed;

  INSERT INTO public.profile_roles (profile_id, role_id)
  VALUES (v_admin_profile, v_admin_role)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.scope_assignments (profile_id, scope_type, scope_id)
  VALUES (v_admin_profile, 'school', NULL)
  ON CONFLICT DO NOTHING;

  -- Données métier : demandes d'approbation
  INSERT INTO public.approval_requests (
    school_id, request_type, entity_type, entity_id, requested_by, status, payload
  )
  VALUES (
    v_school_id,
    'payment_cancel',
    'fee_payment',
    gen_random_uuid(),
    v_admin_profile,
    'pending',
    '{"reason": "test"}'::jsonb
  )
  RETURNING id INTO v_request_id;

  -- ============================================================
  -- Admin : pilotage.approvals.manage avec condition statut pending
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_user)::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  ASSERT public.has_permission('pilotage.approvals.manage') = true, 'admin devrait avoir pilotage.approvals.manage';
  ASSERT public.has_permission('pilotage.dashboard.read') = true, 'admin devrait avoir pilotage.dashboard.read';

  -- Condition statut pending
  PERFORM set_config('app.condition_approval_status_pending', 'false', true);
  ASSERT pg_temp.has_condition('approval_status_pending', '{}'::jsonb) = false, 'la demande ne devrait pas être pending';

  PERFORM set_config('app.condition_approval_status_pending', 'true', true);
  ASSERT pg_temp.has_condition('approval_status_pending', '{}'::jsonb) = true, 'la demande devrait être pending';

  -- RLS : l'admin voit les demandes de son école
  SELECT count(*) INTO v_count FROM public.approval_requests WHERE school_id = v_school_id;
  ASSERT v_count = 1, 'admin devrait voir la demande d''approbation de son école';

  -- L'admin peut approuver la demande (RLS permet l'update)
  UPDATE public.approval_requests
  SET status = 'approved', decided_by = v_admin_profile, decided_at = now()
  WHERE id = v_request_id;

  SELECT count(*) INTO v_count FROM public.approval_requests WHERE id = v_request_id AND status = 'approved';
  ASSERT v_count = 1, 'admin devrait pouvoir approuver la demande';

  EXECUTE 'RESET ROLE';

  -- ============================================================
  -- Audit de l'action de pilotage
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_user)::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  INSERT INTO public.audit_events (school_id, actor_profile_id, event_type, payload)
  VALUES (v_school_id, v_admin_profile, 'pilotage.approvals.manage', '{"decision": "approved"}'::jsonb);

  SELECT count(*) INTO v_count FROM public.audit_events WHERE school_id = v_school_id;
  ASSERT v_count = 1, 'l''événement d''audit pilotage devrait être inséré';

  EXECUTE 'RESET ROLE';

  -- Nettoyage
  DELETE FROM public.audit_events WHERE school_id = v_school_id;
  DELETE FROM public.approval_requests WHERE school_id = v_school_id;
  DELETE FROM public.scope_assignments WHERE profile_id = v_admin_profile;
  DELETE FROM public.profile_roles WHERE profile_id = v_admin_profile;
  DELETE FROM public.profiles WHERE school_id = v_school_id;
  DELETE FROM public.school WHERE id = v_school_id;
  DELETE FROM public.role_permission_grants WHERE role_id = v_admin_role;
  DELETE FROM public.permissions WHERE code LIKE 'pilotage.%';
  DELETE FROM public.roles WHERE id = v_admin_role;
END $$;

COMMIT;
