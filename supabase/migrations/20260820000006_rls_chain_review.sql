-- SchoolSafe V2 — C6 : Revue RLS complète avec la chaîne
-- USER → SCHOOL → ROLE → PERMISSION → SCOPE → CONDITION → EXCEPTION → AUDIT.
--
-- Cette migration ajoute des politiques RESTRICTIVES sur les tables métier prioritaires.
-- Les politiques permissives existantes (principalement *_current_school) restent en place
-- et assurent l'isolement par école. Les politiques restrictives ajoutent la vérification
-- des permissions et, le cas échéant, des portées (scope_assignments).
--
-- Règles appliquées :
--   • Une action sensible (INSERT / UPDATE / DELETE) doit être couverte par une permission.
--   • Les lectures ne sont restreintes que sur les données explicitement sensibles (grades).
--   • Les portées sont vérifiées via public.has_scope lorsque la table le permet.
--   • Les écarts et tables non raccordables sont documentés en commentaire.

-- ============================================================
-- 1. school_settings : UPDATE requiert school.manage
-- ============================================================

DROP POLICY IF EXISTS school_settings_permission_chain_update ON public.school_settings;
CREATE POLICY school_settings_permission_chain_update
  ON public.school_settings
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (public.has_permission('school.manage'))
  WITH CHECK (public.has_permission('school.manage'));

-- ============================================================
-- 2. fee_payments : INSERT / UPDATE requiert une permission finance
-- ============================================================
-- Note : la condition cash_register_open pour INSERT est déjà appliquée par
-- la politique fee_payments_record_condition (migration 20260820000001).
-- Ici on ajoute la vérification de base : seuls les profils disposant de
-- finance.payment.record ou finance.payment.cancel peuvent modifier la table.

DROP POLICY IF EXISTS fee_payments_permission_chain_insert ON public.fee_payments;
CREATE POLICY fee_payments_permission_chain_insert
  ON public.fee_payments
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission('finance.payment.record'));

DROP POLICY IF EXISTS fee_payments_permission_chain_update ON public.fee_payments;
CREATE POLICY fee_payments_permission_chain_update
  ON public.fee_payments
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('finance.payment.record')
    OR public.has_permission('finance.payment.cancel')
  )
  WITH CHECK (
    public.has_permission('finance.payment.record')
    OR public.has_permission('finance.payment.cancel')
  );

-- ============================================================
-- 3. fee_structures : modification requiert finance.fee.manage
-- ============================================================

DROP POLICY IF EXISTS fee_structures_permission_chain_modify ON public.fee_structures;
CREATE POLICY fee_structures_permission_chain_modify
  ON public.fee_structures
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.has_permission('finance.fee.manage'))
  WITH CHECK (public.has_permission('finance.fee.manage'));

-- ============================================================
-- 4. security_events : INSERT requiert security.scan
-- ============================================================
-- Écart : la permission security.scan a pour portée assigned_portal, mais la table
-- security_events possède un location_id, pas un portal_id. La vérification de portée
-- précise ne peut donc pas être exprimée en RLS pour l'instant ; elle reste de la
-- responsabilité de l'API/worker jusqu'à évolution du schéma.

DROP POLICY IF EXISTS security_events_permission_chain_insert ON public.security_events;
CREATE POLICY security_events_permission_chain_insert
  ON public.security_events
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission('security.scan'));

-- ============================================================
-- 5. approval_requests : modification requiert pilotage.approvals.manage
-- ============================================================
-- Écart : la condition status_pending porte sur une transition métier. Elle est
-- appliquée dans la RPC/API de gestion des approbations, pas en RLS UPDATE générique.

DROP POLICY IF EXISTS approval_requests_permission_chain_modify ON public.approval_requests;
CREATE POLICY approval_requests_permission_chain_modify
  ON public.approval_requests
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.has_permission('pilotage.approvals.manage'))
  WITH CHECK (public.has_permission('pilotage.approvals.manage'));

-- ============================================================
-- 6. grades : lecture et modification soumises à permission + portée
-- ============================================================
-- Portées reconnues :
--   • pedagogy.grade.read    → own_children
--   • pedagogy.grade.manage  → assigned_classes ou assigned_subjects
--   • school.manage          → accès complet (administrateur)

DROP POLICY IF EXISTS grades_permission_chain_select ON public.grades;
CREATE POLICY grades_permission_chain_select
  ON public.grades
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('school.manage')
    OR (
      public.has_permission('pedagogy.grade.read')
      AND public.has_scope('own_children', student_id)
    )
    OR (
      public.has_permission('pedagogy.grade.manage')
      AND (
        public.has_scope('assigned_classes', (SELECT a.class_id FROM public.assignments a WHERE a.id = grades.assignment_id))
        OR public.has_scope('assigned_subjects', (SELECT a.subject_id FROM public.assignments a WHERE a.id = grades.assignment_id))
      )
    )
  );

DROP POLICY IF EXISTS grades_permission_chain_insert ON public.grades;
CREATE POLICY grades_permission_chain_insert
  ON public.grades
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('school.manage')
    OR (
      public.has_permission('pedagogy.grade.manage')
      AND (
        public.has_scope('assigned_classes', (SELECT a.class_id FROM public.assignments a WHERE a.id = assignment_id))
        OR public.has_scope('assigned_subjects', (SELECT a.subject_id FROM public.assignments a WHERE a.id = assignment_id))
      )
    )
  );

DROP POLICY IF EXISTS grades_permission_chain_update ON public.grades;
CREATE POLICY grades_permission_chain_update
  ON public.grades
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('school.manage')
    OR (
      public.has_permission('pedagogy.grade.manage')
      AND (
        public.has_scope('assigned_classes', (SELECT a.class_id FROM public.assignments a WHERE a.id = grades.assignment_id))
        OR public.has_scope('assigned_subjects', (SELECT a.subject_id FROM public.assignments a WHERE a.id = grades.assignment_id))
      )
    )
  )
  WITH CHECK (
    public.has_permission('school.manage')
    OR (
      public.has_permission('pedagogy.grade.manage')
      AND (
        public.has_scope('assigned_classes', (SELECT a.class_id FROM public.assignments a WHERE a.id = assignment_id))
        OR public.has_scope('assigned_subjects', (SELECT a.subject_id FROM public.assignments a WHERE a.id = assignment_id))
      )
    )
  );

DROP POLICY IF EXISTS grades_permission_chain_delete ON public.grades;
CREATE POLICY grades_permission_chain_delete
  ON public.grades
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (
    public.has_permission('school.manage')
    OR (
      public.has_permission('pedagogy.grade.manage')
      AND (
        public.has_scope('assigned_classes', (SELECT a.class_id FROM public.assignments a WHERE a.id = grades.assignment_id))
        OR public.has_scope('assigned_subjects', (SELECT a.subject_id FROM public.assignments a WHERE a.id = grades.assignment_id))
      )
    )
  );

-- ============================================================
-- 7. assignments : modification requiert pedagogy.assignment.manage + portée
-- ============================================================

DROP POLICY IF EXISTS assignments_permission_chain_modify ON public.assignments;
CREATE POLICY assignments_permission_chain_modify
  ON public.assignments
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    public.has_permission('school.manage')
    OR (
      public.has_permission('pedagogy.assignment.manage')
      AND (
        public.has_scope('assigned_classes', class_id)
        OR public.has_scope('assigned_subjects', subject_id)
      )
    )
  )
  WITH CHECK (
    public.has_permission('school.manage')
    OR (
      public.has_permission('pedagogy.assignment.manage')
      AND (
        public.has_scope('assigned_classes', class_id)
        OR public.has_scope('assigned_subjects', subject_id)
      )
    )
  );

-- ============================================================
-- 8. card_print_requests : modification requiert cards.request.print
-- ============================================================

DROP POLICY IF EXISTS card_print_requests_permission_chain_modify ON public.card_print_requests;
CREATE POLICY card_print_requests_permission_chain_modify
  ON public.card_print_requests
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.has_permission('cards.request.print'))
  WITH CHECK (public.has_permission('cards.request.print'));

-- ============================================================
-- 9. Tables prioritaires sans politique restrictive ajoutée
-- ============================================================
-- profiles : la politique permissive profiles_update_self limite déjà la mise à jour
--            au profil connecté. Une politique restrictive seule ne peut pas élargir
--            l'accès (les restrictives ne font qu'ajouter des contraintes). Toute
--            évolution sur les modifications admin/staff nécessitera une politique
--            permissive dédiée, pas une restrictive.
--
-- fee_control_scans : déjà couverte par fee_control_scans_condition
--                     (migration 20260820000001) qui vérifie finance.control.scan
--                     et la condition campaign_published.
--
-- locations / student_cards / alerts / alert_notifications : lectures génériques
--                     sans permission dédiée claire dans le catalogue ; laissées
--                     sous la responsabilité des politiques permissives existantes.
