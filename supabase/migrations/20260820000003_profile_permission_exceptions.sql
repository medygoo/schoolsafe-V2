-- SchoolSafe V2 — C2 : Exceptions individuelles de permissions
-- Extension du modèle d'autorisation USER → SCHOOL → ROLE → PERMISSION → SCOPE → CONDITION → EXCEPTION.
-- Contraintes respectées :
--   • DENY explicite l'emporte sur ALLOW (rôle OU exception).
--   • Tout ce qui n'est pas explicitement autorisé = DENY.
--   • Les exceptions actives (non expirées) sont évaluées APRÈS les DENY de rôle.
--   • Aucune modification des migrations existantes ; tout est ajouté ici.

-- ============================================================
-- 1. Table des exceptions individuelles
-- ============================================================
CREATE TABLE public.profile_permission_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission_code text NOT NULL,
  allowed boolean NOT NULL,
  reason text NOT NULL,
  granted_by uuid NOT NULL REFERENCES public.profiles(id),
  granted_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz,
  UNIQUE(profile_id, permission_code)
);

CREATE INDEX IF NOT EXISTS profile_permission_exceptions_profile_id_idx
  ON public.profile_permission_exceptions(profile_id);

CREATE INDEX IF NOT EXISTS profile_permission_exceptions_permission_code_idx
  ON public.profile_permission_exceptions(permission_code);

COMMENT ON TABLE public.profile_permission_exceptions IS
  'Exceptions individuelles : accordent ou révoquent une permission pour un profil précis, avec priorité DENY > ALLOW.';

-- ============================================================
-- 2. has_permission : résolution rôle + exception
--
--    Ordre de résolution :
--      a. Si un rôle a allowed = false → DENY.
--      b. Si une exception allowed = false active existe → DENY.
--      c. Si une exception allowed = true active existe → ALLOW.
--      d. Sinon, retourne le résultat des rôles (avec conditions).
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_permission(permission_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT
    -- a. aucun rôle ne refuse explicitement
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
    AND
    -- b. aucune exception DENY active n'existe
    NOT EXISTS (
      SELECT 1
      FROM public.profile_permission_exceptions ppe
      WHERE ppe.profile_id = public.current_profile_id()
        AND ppe.permission_code = permission_code
        AND ppe.allowed = false
        AND (ppe.expires_at IS NULL OR ppe.expires_at > now())
    )
    AND
    (
      -- c. une exception ALLOW active existe
      EXISTS (
        SELECT 1
        FROM public.profile_permission_exceptions ppe
        WHERE ppe.profile_id = public.current_profile_id()
          AND ppe.permission_code = permission_code
          AND ppe.allowed = true
          AND (ppe.expires_at IS NULL OR ppe.expires_at > now())
      )
      OR
      -- d. au moins un rôle autorise et toutes les conditions attachées sont satisfaites
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
    )
$$;

REVOKE ALL ON FUNCTION public.has_permission(text) FROM public;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;

-- ============================================================
-- 3. Audit des exceptions individuelles
-- ============================================================
CREATE OR REPLACE FUNCTION public.audit_profile_permission_exceptions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_school_id uuid;
  v_actor_profile_id uuid;
  v_event_type text;
  v_payload jsonb;
  v_target_profile_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_target_profile_id := NEW.profile_id;
    v_actor_profile_id := NEW.granted_by;
    v_event_type := 'user.exception.added';
    v_payload := jsonb_build_object(
      'profile_id', NEW.profile_id,
      'permission_code', NEW.permission_code,
      'allowed', NEW.allowed,
      'reason', NEW.reason,
      'granted_by', NEW.granted_by,
      'granted_at', NEW.granted_at,
      'expires_at', NEW.expires_at
    );
  ELSIF TG_OP = 'UPDATE' THEN
    v_target_profile_id := NEW.profile_id;
    v_actor_profile_id := NEW.granted_by;
    IF NEW.allowed = true THEN
      v_event_type := 'role.permission.granted';
    ELSE
      v_event_type := 'role.permission.revoked';
    END IF;
    v_payload := jsonb_build_object(
      'profile_id', NEW.profile_id,
      'permission_code', NEW.permission_code,
      'allowed', NEW.allowed,
      'previous_allowed', OLD.allowed,
      'reason', NEW.reason,
      'granted_by', NEW.granted_by,
      'granted_at', NEW.granted_at,
      'expires_at', NEW.expires_at
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_target_profile_id := OLD.profile_id;
    v_actor_profile_id := OLD.granted_by;
    v_event_type := 'user.exception.removed';
    v_payload := jsonb_build_object(
      'profile_id', OLD.profile_id,
      'permission_code', OLD.permission_code,
      'allowed', OLD.allowed,
      'reason', OLD.reason,
      'granted_by', OLD.granted_by,
      'granted_at', OLD.granted_at,
      'expires_at', OLD.expires_at
    );
  ELSE
    RETURN NULL;
  END IF;

  SELECT school_id INTO v_school_id
  FROM public.profiles
  WHERE id = v_target_profile_id;

  IF v_school_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.audit_events (
    school_id,
    actor_profile_id,
    event_type,
    payload
  ) VALUES (
    v_school_id,
    v_actor_profile_id,
    v_event_type,
    v_payload
  );

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_profile_permission_exceptions() FROM public;
GRANT EXECUTE ON FUNCTION public.audit_profile_permission_exceptions() TO authenticated;

DROP TRIGGER IF EXISTS audit_profile_permission_exceptions
  ON public.profile_permission_exceptions;

CREATE TRIGGER audit_profile_permission_exceptions
AFTER INSERT OR UPDATE OR DELETE ON public.profile_permission_exceptions
FOR EACH ROW EXECUTE FUNCTION public.audit_profile_permission_exceptions();

-- ============================================================
-- 4. Permissions de base sur la nouvelle table
-- ============================================================
REVOKE ALL ON TABLE public.profile_permission_exceptions FROM anon, authenticated;
