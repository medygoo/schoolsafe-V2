-- SchoolSafe V2 — Grants par défaut des rôles standards
-- Alimente le catalogue public.permissions (59 permissions, source : shared/permissions.json)
-- et seed les role_permission_grants (allowed = true) selon la matrice validée.
-- Contraintes respectées :
--   • Règle Access_Law : Utilisateur → Rôle → Permission → Portée → Exception.
--   • Tout ce qui n'est pas explicitement autorisé = DENY (comportement de has_permission inchangé).
--   • Idempotent : ré-exécutable sans effet de bord (on conflict do nothing).
--   • Aucune modification des migrations existantes ; tout est ajouté ici.

-- ============================================================
-- 1. Catalogue des permissions (59 entrées)
--    code = identifiant stable, description = label fonctionnel.
-- ============================================================
INSERT INTO public.permissions (code, description) VALUES
  ('session.bootstrap', 'Bootstrap initial de l''école'),
  ('school.class.read', 'Lire les classes'),
  ('school.student.read', 'Lire les dossiers élèves'),
  ('school.guardian.read', 'Lire les tuteurs'),
  ('school.guardian.manage', 'Gérer les tuteurs'),
  ('school.manage', 'Gérer l''école'),
  ('staff.manage', 'Gérer le personnel'),
  ('roles.manage', 'Gérer les rôles et permissions'),
  ('security.pickup.read', 'Lire les autorisations de pick-up'),
  ('security.pickup.manage', 'Gérer les pick-up'),
  ('security.scan', 'Scanner un QR'),
  ('security.lockdown.manage', 'Gérer le lockdown'),
  ('security.events.read', 'Lire les événements de sécurité'),
  ('security.card.create', 'Créer une carte'),
  ('pilotage.dashboard.read', 'Lire le tableau de bord'),
  ('pilotage.alerts.read', 'Lire les alertes'),
  ('pilotage.alerts.manage', 'Gérer les alertes'),
  ('pilotage.approvals.read', 'Lire les demandes d''approbation'),
  ('pilotage.approvals.manage', 'Gérer les approbations'),
  ('email.send', 'Envoyer des emails'),
  ('finance.fee.read', 'Lire les frais scolaires'),
  ('finance.fee.manage', 'Gérer les frais scolaires'),
  ('finance.payment.record', 'Enregistrer un paiement'),
  ('finance.payment.cancel', 'Annuler un paiement'),
  ('finance.receipt.read', 'Lire les reçus'),
  ('finance.report.read', 'Lire les rapports financiers'),
  ('finance.cash_register.close', 'Clôturer la caisse'),
  ('finance.control.read', 'Lire les campagnes de contrôle'),
  ('finance.control.manage', 'Gérer les campagnes de contrôle'),
  ('finance.control.scan', 'Scanner un contrôle de frais'),
  ('finance.status.read', 'Lire le statut financier'),
  ('pedagogy.subject.read', 'Lire les matières'),
  ('pedagogy.subject.manage', 'Gérer les matières'),
  ('pedagogy.assignment.read', 'Lire les devoirs'),
  ('pedagogy.assignment.manage', 'Gérer les devoirs'),
  ('pedagogy.grade.read', 'Lire les notes'),
  ('pedagogy.grade.manage', 'Gérer les notes'),
  ('pedagogy.lesson-plan.read', 'Lire le cahier de préparation'),
  ('pedagogy.lesson-plan.manage', 'Gérer le cahier de préparation'),
  ('pedagogy.report.read', 'Lire les rapports pédagogiques'),
  ('pedagogy.report.manage', 'Gérer les rapports pédagogiques'),
  ('palmarques.read', 'Consulter le palmarès'),
  ('palmarques.manage', 'Gérer le palmarès'),
  ('staff.read', 'Consulter le personnel'),
  ('staff.attendance.read', 'Consulter les présences du personnel'),
  ('canteen.manage', 'Gérer la cantine'),
  ('infirmary.manage', 'Gérer l''infirmerie'),
  ('communication.announcement.manage', 'Gérer les annonces'),
  ('communication.message.send', 'Envoyer des messages'),
  ('safe.assistant.use', 'Utiliser l''assistant Safe'),
  ('reports.operational.read', 'Lire les rapports opérationnels'),
  ('reports.financial.read', 'Lire les rapports financiers'),
  ('reports.security.read', 'Lire les rapports de sécurité'),
  ('reports.hr.read', 'Lire les rapports RH'),
  ('sync.submit', 'Soumettre une synchronisation'),
  ('file.upload', 'Téléverser un fichier'),
  ('file.download', 'Télécharger un fichier'),
  ('cards.request.print', 'Demander l''impression d''une carte'),
  ('notification.subscribe', 'S''abonner aux notifications')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 2. Rôles standards (données de référence, pas données métier)
--    La table roles est vide sur une base neuve à ce stade :
--    sans eux, la jointure des grants (section 3) ne produirait rien.
--    UUID stables identiques à supabase/seed.sql ; idempotent.
-- ============================================================
INSERT INTO public.roles (id, code, label) VALUES
  ('20000000-0000-0000-0000-000000000001', 'admin', 'Administrateur'),
  ('20000000-0000-0000-0000-000000000002', 'school_head', 'Direction'),
  ('20000000-0000-0000-0000-000000000003', 'pedagogy', 'Direction pédagogique'),
  ('20000000-0000-0000-0000-000000000004', 'teacher', 'Enseignant'),
  ('20000000-0000-0000-0000-000000000005', 'cashier', 'Caisse'),
  ('20000000-0000-0000-0000-000000000006', 'guard', 'Gardien'),
  ('20000000-0000-0000-0000-000000000007', 'parent', 'Parent')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. Grants par défaut (allowed = true)
--    Jointure sur les codes (roles.code / permissions.code) :
--    aucune hypothèse sur les UUID, idempotent.
--    COMMUN à tous les rôles : session.bootstrap, sync.submit,
--    file.upload, file.download, notification.subscribe, safe.assistant.use.
-- ============================================================

-- 2.1 admin : TOUTES les permissions du catalogue.
INSERT INTO public.role_permission_grants (role_id, permission_id, allowed)
SELECT r.id, p.id, true
FROM public.roles r
JOIN public.permissions p ON true
WHERE r.code = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 2.2 school_head : COMMUN + pilotage, lecture école/pédagogie/finance/sécurité,
--    rapports et communication.
INSERT INTO public.role_permission_grants (role_id, permission_id, allowed)
SELECT r.id, p.id, true
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'session.bootstrap', 'sync.submit', 'file.upload', 'file.download',
  'notification.subscribe', 'safe.assistant.use',
  'pilotage.dashboard.read', 'pilotage.alerts.read', 'pilotage.alerts.manage',
  'pilotage.approvals.read', 'pilotage.approvals.manage',
  'school.class.read', 'school.student.read', 'school.guardian.read',
  'staff.read', 'staff.attendance.read',
  'pedagogy.report.read', 'palmarques.read',
  'finance.report.read', 'finance.status.read',
  'security.events.read',
  'reports.operational.read', 'reports.financial.read', 'reports.security.read', 'reports.hr.read',
  'communication.announcement.manage', 'communication.message.send', 'email.send'
)
WHERE r.code = 'school_head'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 2.3 pedagogy : COMMUN + gestion pédagogique complète, lecture école,
--    palmarès, statut financier, pilotage.
INSERT INTO public.role_permission_grants (role_id, permission_id, allowed)
SELECT r.id, p.id, true
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'session.bootstrap', 'sync.submit', 'file.upload', 'file.download',
  'notification.subscribe', 'safe.assistant.use',
  'pedagogy.subject.read', 'pedagogy.subject.manage',
  'pedagogy.assignment.read', 'pedagogy.assignment.manage',
  'pedagogy.grade.read', 'pedagogy.grade.manage',
  'pedagogy.lesson-plan.read', 'pedagogy.lesson-plan.manage',
  'pedagogy.report.read', 'pedagogy.report.manage',
  'palmarques.read', 'palmarques.manage',
  'school.class.read', 'school.student.read', 'school.guardian.read',
  'finance.status.read',
  'pilotage.dashboard.read', 'pilotage.alerts.read',
  'reports.operational.read'
)
WHERE r.code = 'pedagogy'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 2.4 teacher : COMMUN + pédagogie courante (devoirs, notes, cahier de préparation),
--    lecture classes/élèves/tuteurs, palmarès et alertes.
INSERT INTO public.role_permission_grants (role_id, permission_id, allowed)
SELECT r.id, p.id, true
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'session.bootstrap', 'sync.submit', 'file.upload', 'file.download',
  'notification.subscribe', 'safe.assistant.use',
  'pedagogy.subject.read',
  'pedagogy.assignment.read', 'pedagogy.assignment.manage',
  'pedagogy.grade.read', 'pedagogy.grade.manage',
  'pedagogy.lesson-plan.read', 'pedagogy.lesson-plan.manage',
  'school.class.read', 'school.student.read', 'school.guardian.read',
  'palmarques.read',
  'pilotage.alerts.read'
)
WHERE r.code = 'teacher'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 2.5 cashier : COMMUN + opérations de caisse et rapports financiers.
INSERT INTO public.role_permission_grants (role_id, permission_id, allowed)
SELECT r.id, p.id, true
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'session.bootstrap', 'sync.submit', 'file.upload', 'file.download',
  'notification.subscribe', 'safe.assistant.use',
  'finance.fee.read', 'finance.payment.record', 'finance.payment.cancel',
  'finance.receipt.read', 'finance.report.read',
  'finance.cash_register.close', 'finance.status.read',
  'pilotage.dashboard.read'
)
WHERE r.code = 'cashier'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 2.6 guard : COMMUN + scan QR et gestion des pick-up.
INSERT INTO public.role_permission_grants (role_id, permission_id, allowed)
SELECT r.id, p.id, true
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'session.bootstrap', 'sync.submit', 'file.upload', 'file.download',
  'notification.subscribe', 'safe.assistant.use',
  'security.scan', 'security.pickup.read', 'security.pickup.manage', 'security.events.read'
)
WHERE r.code = 'guard'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 2.7 parent : COMMUN + suivi de ses enfants (notes, devoirs, palmarès,
--    reçus, statut financier, pick-up, tuteurs).
INSERT INTO public.role_permission_grants (role_id, permission_id, allowed)
SELECT r.id, p.id, true
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'session.bootstrap', 'sync.submit', 'file.upload', 'file.download',
  'notification.subscribe', 'safe.assistant.use',
  'pedagogy.grade.read', 'pedagogy.assignment.read',
  'palmarques.read',
  'finance.receipt.read', 'finance.status.read',
  'security.pickup.read', 'school.guardian.read'
)
WHERE r.code = 'parent'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================
-- 3. Correctif audit des exceptions individuelles (A5)
--    Branche UPDATE uniquement : event_type devient 'user.exception.updated'
--    (au lieu de role.permission.granted/revoked, réservés aux grants de rôle).
--    Le payload existant (allowed + previous_allowed) est conservé.
--    Les branches INSERT et DELETE sont inchangées.
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
    v_event_type := 'user.exception.updated';
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

-- ============================================================
-- 5. Lecture des exceptions par le profil concerné
--    Le bootstrap de session (contexte utilisateur) doit pouvoir lire
--    les exceptions actives pour que l'UI reflète les DENY/ALLOW.
--    Chaque profil ne lit que ses propres exceptions (RLS).
--    L'administration (console rôles/accès) passe par le service role.
-- ============================================================
GRANT SELECT ON TABLE public.profile_permission_exceptions TO authenticated;

ALTER TABLE public.profile_permission_exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profile_permission_exceptions_select_own
  ON public.profile_permission_exceptions;

CREATE POLICY profile_permission_exceptions_select_own
  ON public.profile_permission_exceptions
  FOR SELECT TO authenticated
  USING (profile_id = public.current_profile_id());
