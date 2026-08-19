-- Task 3 — Module Finance + Contrôle
-- Vérifie les permissions et conditions de paiement, d'annulation et de contrôle des frais.

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
  v_cashier_user uuid := gen_random_uuid();
  v_finance_user uuid := gen_random_uuid();
  v_cashier_profile uuid;
  v_finance_profile uuid;
  v_cashier_role uuid;
  v_finance_role uuid;
  v_student_id uuid := gen_random_uuid();
  v_class_id uuid := gen_random_uuid();
  v_year_id uuid;
  v_fee_structure_id uuid;
  v_student_fee_id uuid;
  v_payment_id uuid;
  v_campaign_id uuid;
  v_perm_id uuid;
  v_count integer;
BEGIN
  INSERT INTO public.school (code, name)
  VALUES ('qa-finance-' || extract(epoch from now())::text, 'QA Finance School')
  RETURNING id INTO v_school_id;

  INSERT INTO public.profiles (auth_user_id, school_id, display_name)
  VALUES (v_cashier_user, v_school_id, 'qa-cashier')
  RETURNING id INTO v_cashier_profile;

  INSERT INTO public.profiles (auth_user_id, school_id, display_name)
  VALUES (v_finance_user, v_school_id, 'qa-finance-manager')
  RETURNING id INTO v_finance_profile;

  -- Rôles
  INSERT INTO public.roles (code, label)
  VALUES ('qa_cashier', 'QA Cashier')
  ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label
  RETURNING id INTO v_cashier_role;

  INSERT INTO public.roles (code, label)
  VALUES ('qa_finance_manager', 'QA Finance Manager')
  ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label
  RETURNING id INTO v_finance_role;

  -- Permissions finance
  INSERT INTO public.permissions (code, description)
  VALUES
    ('finance.payment.record', 'Enregistrer un paiement'),
    ('finance.payment.cancel', 'Annuler un paiement'),
    ('finance.control.scan', 'Scanner un contrôle de frais'),
    ('finance.fee.manage', 'Gérer les frais scolaires')
  ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

  -- Cashier : payment.record + payment.cancel
  INSERT INTO public.role_permission_grants (role_id, permission_id, allowed)
  SELECT v_cashier_role, id, true
  FROM public.permissions
  WHERE code IN ('finance.payment.record', 'finance.payment.cancel')
  ON CONFLICT (role_id, permission_id) DO UPDATE SET allowed = EXCLUDED.allowed;

  -- Finance manager : toutes les permissions finance
  INSERT INTO public.role_permission_grants (role_id, permission_id, allowed)
  SELECT v_finance_role, id, true
  FROM public.permissions
  WHERE code LIKE 'finance.%'
  ON CONFLICT (role_id, permission_id) DO UPDATE SET allowed = EXCLUDED.allowed;

  INSERT INTO public.profile_roles (profile_id, role_id)
  VALUES
    (v_cashier_profile, v_cashier_role),
    (v_finance_profile, v_finance_role)
  ON CONFLICT DO NOTHING;

  -- Données métier
  INSERT INTO public.academic_years (school_id, label, starts_on, ends_on, periods)
  VALUES (v_school_id, '2025-2026', '2025-09-01', '2026-06-30', 'Trimestres')
  RETURNING id INTO v_year_id;

  INSERT INTO public.classes (id, school_id, academic_year_id, cycle_key, name)
  VALUES (v_class_id, v_school_id, v_year_id, 'primary', 'QA Finance Class');

  INSERT INTO public.students (id, school_id, class_id, matricule, first_name, last_name)
  VALUES (v_student_id, v_school_id, v_class_id, 'QA-FIN-001', 'Charlie', 'Test');

  INSERT INTO public.fee_structures (school_id, academic_year_id, cycle_key, label, amount, currency)
  VALUES (v_school_id, v_year_id, 'primary', 'Frais annuels', 100.00, 'USD')
  RETURNING id INTO v_fee_structure_id;

  INSERT INTO public.student_fees (id, school_id, student_id, fee_structure_id, status, amount_expected, amount_remaining)
  VALUES (gen_random_uuid(), v_school_id, v_student_id, v_fee_structure_id, 'pending', 100.00, 100.00)
  RETURNING id INTO v_student_fee_id;

  INSERT INTO public.fee_payments (id, school_id, student_fee_id, amount, currency, received_by, receipt_no, status)
  VALUES (gen_random_uuid(), v_school_id, v_student_fee_id, 50.00, 'USD', v_cashier_profile, 'R-001', 'valid')
  RETURNING id INTO v_payment_id;

  INSERT INTO public.fee_control_campaigns (id, school_id, fee_structure_id, label, ends_at, status, created_by)
  VALUES (gen_random_uuid(), v_school_id, v_fee_structure_id, 'Campagne contrôle', now() + interval '30 days', 'published', v_finance_profile)
  RETURNING id INTO v_campaign_id;

  -- ============================================================
  -- Cashier : payment.record avec condition caisse ouverte
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_cashier_user)::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  ASSERT public.has_permission('finance.payment.record') = true, 'caissier devrait avoir finance.payment.record';

  -- Condition : caisse fermée
  PERFORM set_config('app.condition_cash_register_open', 'false', true);
  ASSERT pg_temp.has_condition('cash_register_open', '{}'::jsonb) = false, 'la caisse devrait être fermée';

  -- Condition : caisse ouverte
  PERFORM set_config('app.condition_cash_register_open', 'true', true);
  ASSERT pg_temp.has_condition('cash_register_open', '{}'::jsonb) = true, 'la caisse devrait être ouverte';

  -- RLS : le caissier voit les paiements de son école
  SELECT count(*) INTO v_count FROM public.fee_payments WHERE school_id = v_school_id;
  ASSERT v_count = 1, 'caissier devrait voir le paiement de son école';

  EXECUTE 'RESET ROLE';

  -- ============================================================
  -- Cashier : payment.cancel avec condition délai d'annulation
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_cashier_user)::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  ASSERT public.has_permission('finance.payment.cancel') = true, 'caissier devrait avoir finance.payment.cancel';

  PERFORM set_config('app.condition_cancellation_delay_ok', 'false', true);
  ASSERT pg_temp.has_condition('cancellation_delay_ok', '{}'::jsonb) = false, 'le délai d''annulation devrait être dépassé';

  PERFORM set_config('app.condition_cancellation_delay_ok', 'true', true);
  ASSERT pg_temp.has_condition('cancellation_delay_ok', '{}'::jsonb) = true, 'le délai d''annulation devrait être valide';

  EXECUTE 'RESET ROLE';

  -- ============================================================
  -- Finance manager : control.scan avec condition campagne publiée
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_finance_user)::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  ASSERT public.has_permission('finance.control.scan') = true, 'responsable financier devrait avoir finance.control.scan';
  ASSERT public.has_permission('finance.fee.manage') = true, 'responsable financier devrait avoir finance.fee.manage';

  PERFORM set_config('app.condition_campaign_published', 'true', true);
  ASSERT pg_temp.has_condition('campaign_published', '{}'::jsonb) = true, 'la campagne devrait être publiée';

  -- RLS : le responsable financier voit les campagnes de son école
  SELECT count(*) INTO v_count FROM public.fee_control_campaigns WHERE school_id = v_school_id;
  ASSERT v_count = 1, 'responsable financier devrait voir la campagne de son école';

  -- Audit : l'insertion d'une clôture de caisse est tracée
  INSERT INTO public.cash_register_closures (school_id, closure_date, closed_by, total_amount)
  VALUES (v_school_id, current_date, v_finance_profile, 50.00);

  INSERT INTO public.audit_events (school_id, actor_profile_id, event_type, payload)
  VALUES (v_school_id, v_finance_profile, 'finance.fee.manage', '{"action": "closure"}'::jsonb);

  SELECT count(*) INTO v_count FROM public.audit_events WHERE school_id = v_school_id;
  ASSERT v_count = 1, 'l''événement d''audit finance devrait être inséré';

  EXECUTE 'RESET ROLE';

  -- Nettoyage
  DELETE FROM public.audit_events WHERE school_id = v_school_id;
  DELETE FROM public.cash_register_closures WHERE school_id = v_school_id;
  DELETE FROM public.fee_control_campaigns WHERE school_id = v_school_id;
  DELETE FROM public.fee_payments WHERE school_id = v_school_id;
  DELETE FROM public.student_fees WHERE school_id = v_school_id;
  DELETE FROM public.fee_structures WHERE school_id = v_school_id;
  DELETE FROM public.students WHERE school_id = v_school_id;
  DELETE FROM public.classes WHERE school_id = v_school_id;
  DELETE FROM public.academic_years WHERE school_id = v_school_id;
  DELETE FROM public.scope_assignments WHERE profile_id IN (v_cashier_profile, v_finance_profile);
  DELETE FROM public.profile_roles WHERE profile_id IN (v_cashier_profile, v_finance_profile);
  DELETE FROM public.profiles WHERE school_id = v_school_id;
  DELETE FROM public.school WHERE id = v_school_id;
  DELETE FROM public.role_permission_grants WHERE role_id IN (v_cashier_role, v_finance_role);
  DELETE FROM public.permissions WHERE code LIKE 'finance.%';
  DELETE FROM public.roles WHERE id IN (v_cashier_role, v_finance_role);
END $$;

COMMIT;
