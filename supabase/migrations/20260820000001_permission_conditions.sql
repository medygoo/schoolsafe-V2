-- SchoolSafe V2 — C1 : Système de conditions sur les permissions
-- Extension du modèle d'autorisation USER → SCHOOL → ROLE → PERMISSION → SCOPE → CONDITION.
-- Contraintes respectées :
--   • DENY explicite l'emporte sur ALLOW.
--   * Tout ce qui n'est pas explicitement autorisé = DENY.
--   * Les conditions sont évaluées APRÈS les vérifications rôle/permission.
--   * Aucune modification des migrations existantes ; tout est ajouté ici.

-- ============================================================
-- 1. Enum des types de condition
-- ============================================================
CREATE TYPE public.condition_type AS ENUM (
  'academic_year_active',
  'cash_register_open',
  'campaign_published',
  'within_cancellation_window',
  'quota_available',
  'device_managed',
  'status_pending',
  'portal_open'
);

-- ============================================================
-- 2. Colonne technique id sur role_permission_grants
--    permission_conditions a besoin d'une cible de FK stable.
-- ============================================================
ALTER TABLE public.role_permission_grants
  ADD COLUMN IF NOT EXISTS id uuid UNIQUE DEFAULT gen_random_uuid();

COMMENT ON COLUMN public.role_permission_grants.id IS 'Identifiant stable du grant, utilisé par permission_conditions.';

-- ============================================================
-- 3. Table de liaison conditions ↔ grants
-- ============================================================
CREATE TABLE public.permission_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id uuid REFERENCES public.role_permission_grants(id) ON DELETE CASCADE,
  condition_type public.condition_type NOT NULL,
  condition_params jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS permission_conditions_grant_id_idx
  ON public.permission_conditions(grant_id);

-- ============================================================
-- 4. Tables référencées par has_condition mais absentes du schéma
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.school(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  opened_at timestamptz DEFAULT now(),
  closed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  closed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (school_id, date)
);

COMMENT ON TABLE public.cash_registers IS 'Caisse journalière. Une ligne par école/jour ; status open/closed.';

CREATE TABLE IF NOT EXISTS public.security_portals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.school(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  is_open boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (school_id, code)
);

COMMENT ON TABLE public.security_portals IS 'Portail de sécurité (contrôle d''accès). is_open autorise les scans.';

-- ============================================================
-- 5. RPC d'évaluation d'une condition
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_condition(
  p_condition_type public.condition_type,
  p_params jsonb DEFAULT '{}'::jsonb
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_school_id uuid;
  v_uuid uuid;
  v_date date;
BEGIN
  v_profile_id := public.current_profile_id();
  SELECT school_id INTO v_school_id FROM public.profiles WHERE id = v_profile_id;

  CASE p_condition_type
    WHEN 'academic_year_active' THEN
      RETURN EXISTS (
        SELECT 1 FROM public.academic_years
        WHERE school_id = v_school_id AND is_active = true
      );

    WHEN 'cash_register_open' THEN
      BEGIN
        v_date := NULL;
        IF p_params ? 'date' AND p_params->>'date' IS NOT NULL THEN
          v_date := (p_params->>'date')::date;
        END IF;
      EXCEPTION WHEN others THEN
        RETURN false;
      END;
      RETURN EXISTS (
        SELECT 1 FROM public.cash_registers
        WHERE school_id = v_school_id AND status = 'open'
          AND (v_date IS NULL OR date = v_date)
      );

    WHEN 'campaign_published' THEN
      BEGIN
        v_uuid := (p_params->>'campaign_id')::uuid;
      EXCEPTION WHEN others THEN
        RETURN false;
      END;
      IF v_uuid IS NULL THEN RETURN false; END IF;
      RETURN EXISTS (
        SELECT 1 FROM public.fee_control_campaigns
        WHERE id = v_uuid AND status = 'published'
      );

    WHEN 'within_cancellation_window' THEN
      BEGIN
        v_uuid := (p_params->>'payment_id')::uuid;
      EXCEPTION WHEN others THEN
        RETURN false;
      END;
      IF v_uuid IS NULL THEN RETURN false; END IF;
      RETURN EXISTS (
        SELECT 1 FROM public.fee_payments
        WHERE id = v_uuid
          AND created_at > now() - interval '24 hours'
      );

    WHEN 'status_pending' THEN
      BEGIN
        v_uuid := (p_params->>'request_id')::uuid;
      EXCEPTION WHEN others THEN
        RETURN false;
      END;
      IF v_uuid IS NULL THEN RETURN false; END IF;
      RETURN EXISTS (
        SELECT 1 FROM public.approval_requests
        WHERE id = v_uuid AND status = 'pending'
      );

    WHEN 'portal_open' THEN
      BEGIN
        v_uuid := (p_params->>'portal_id')::uuid;
      EXCEPTION WHEN others THEN
        RETURN false;
      END;
      IF v_uuid IS NULL THEN RETURN false; END IF;
      RETURN EXISTS (
        SELECT 1 FROM public.security_portals
        WHERE id = v_uuid AND is_open = true
      );

    WHEN 'quota_available' THEN
      -- Non implémenté dans cette version ; condition conservée dans l'enum pour évolution.
      RETURN false;

    WHEN 'device_managed' THEN
      -- Vrai si le profil possède au moins un appareil géré par l'école non révoqué.
      RETURN EXISTS (
        SELECT 1 FROM public.devices
        WHERE profile_id = v_profile_id
          AND is_school_managed = true
          AND revoked_at IS NULL
      );

    ELSE
      RETURN false;
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION public.has_condition(public.condition_type, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.has_condition(public.condition_type, jsonb) TO authenticated;

-- ============================================================
-- 6. has_permission : intègre les conditions aux grants ALLOW
--    Ordre de résolution : DENY > ALLOW sans condition échouée > DENY implicite.
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_permission(permission_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT
    -- au moins un rôle autorise ET toutes les conditions attachées à ce grant sont satisfaites
    EXISTS (
      SELECT 1
      FROM public.profile_roles pr
      JOIN public.role_permission_grants rpg
        ON rpg.role_id = pr.role_id
       AND rpg.allowed = true
      JOIN public.permissions perm
        ON perm.id = rpg.permission_id
      WHERE pr.profile_id = public.current_profile_id()
        AND perm.code = permission_code
        AND NOT EXISTS (
          SELECT 1
          FROM public.permission_conditions pc
          WHERE pc.grant_id = rpg.id
            AND NOT public.has_condition(pc.condition_type, pc.condition_params)
        )
    )
    AND
    -- aucun rôle ne refuse explicitement
    NOT EXISTS (
      SELECT 1
      FROM public.profile_roles pr
      JOIN public.role_permission_grants rpg
        ON rpg.role_id = pr.role_id
       AND rpg.allowed = false
      JOIN public.permissions perm
        ON perm.id = rpg.permission_id
      WHERE pr.profile_id = public.current_profile_id()
        AND perm.code = permission_code
    )
$$;

REVOKE ALL ON FUNCTION public.has_permission(text) FROM public;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;

-- ============================================================
-- 7. Application en RLS : politiques RESTRICTIVES
--    Elles s'ajoutent aux politiques permissives existantes ; toutes doivent être vraies.
-- ============================================================

-- 7.1 finance.payment.record → INSERT sur fee_payments (caisse ouverte)
DROP POLICY IF EXISTS fee_payments_record_condition ON public.fee_payments;
CREATE POLICY fee_payments_record_condition
ON public.fee_payments
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_permission('finance.payment.record')
  AND public.has_condition('cash_register_open', jsonb_build_object('date', current_date))
);

-- 7.2 finance.payment.cancel → vérification du délai d'annulation.
-- La condition ne peut pas être appliquée en RLS UPDATE générique sans bloquer les
-- autres mises à jour légitimes de fee_payments. Elle est donc appliquée dans la
-- RPC public.cancel_payment (voir migration 20260820000002).

-- 7.3 finance.control.scan → INSERT sur fee_control_scans (campagne publiée)
DROP POLICY IF EXISTS fee_control_scans_condition ON public.fee_control_scans;
CREATE POLICY fee_control_scans_condition
ON public.fee_control_scans
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_permission('finance.control.scan')
  AND public.has_condition('campaign_published', jsonb_build_object('campaign_id', campaign_id))
);

-- 7.4 pilotage.approvals.manage → vérification du statut pending.
-- Comme pour l'annulation, la condition porte sur une transition métier (passage
-- d'une demande de pending à approved/rejected). Elle est appliquée dans l'API/
-- RPC de gestion des approbations, pas en RLS UPDATE générique.

-- ============================================================
-- 8. Permissions critiques non raccordables en RLS dans cette itération
-- ============================================================
COMMENT ON POLICY fee_payments_record_condition ON public.fee_payments IS
  'finance.payment.record : condition cash_register_open appliquée.';

COMMENT ON FUNCTION public.cancel_payment IS
  'finance.payment.cancel : condition within_cancellation_window appliquée dans la RPC.';

COMMENT ON POLICY fee_control_scans_condition ON public.fee_control_scans IS
  'finance.control.scan : condition campaign_published appliquée.';

-- pilotage.approvals.manage : la condition status_pending doit être appliquée dans la RPC/API
-- de gestion des approbations (aucune RPC existante à cibler pour COMMENT ON FUNCTION).

-- security.scan :
--   Table cible : security_events (existe).
--   Condition attendue : portal_open avec portal_id.
--   Écart : security_events possède location_id, pas portal_id ; la table security_portals est créée
--           mais le lien scan/portail n'est pas encore modélisé. La vérification doit donc être faite
--           côté API/worker jusqu'à évolution du schéma.

-- security.pickup.manage :
--   Table cible : non créée (pickups / student_pickups inexistant).
--   Action : documenté ; à intégrer lors de la création de la table métier.

-- pedagogy.grade.manage :
--   Table cible : grades (existe).
--   Condition attendue : empêcher la modification d'une note publiée.
--   Écart : l'enum condition_type ne contient pas de valeur grade_not_published / grade_draft.
--           La logique sera ajoutée lors de l'extension de l'enum ou via une condition métier côté API.

-- email.send :
--   Table cible : non créée (emails / outbox inexistant).
--   Action : documenté ; à intégrer lors de la création de la table métier.
