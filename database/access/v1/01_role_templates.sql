\set ON_ERROR_STOP on

-- SchoolSafe Access v1 — modèles de rôles (templates) et grants par défaut.
-- Correction ACL-01 : les 4 rôles manquants (fee_control, hr, staff,
-- hikvision_admin), le bornage palmarès Parent à own_children, l'annulation
-- caissier conditionnée (within_cancellation_window), et la fin du grant
-- aveugle admin (le snapshot explicite ci-dessous fige les 60 permissions
-- actuelles : toute permission FUTURE exigera une nouvelle version du pack).
--
-- Ces tables sont des données de RÉFÉRENCE globales à l'environnement
-- (comme iam.permissions/iam.scopes) : pas de school_id. Isolation :
-- FORCE RLS sans policy + aucun accès direct aux rôles applicatifs.

begin;
set local role schoolsafe_owner;

create table if not exists iam.role_templates (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  code text not null unique,
  label text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table if not exists iam.role_template_grants (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  template_id uuid not null references iam.role_templates (id),
  permission_id uuid not null references iam.permissions (id),
  default_scope_code text not null references iam.scopes (code),
  condition_code text,
  condition_params jsonb not null default '{}'::jsonb,
  effect text not null default 'allow' check (effect in ('allow', 'deny')),
  created_at timestamptz not null default pg_catalog.now(),
  unique (template_id, permission_id)
);

do $schoolsafe$
declare
  v_table regclass;
begin
  foreach v_table in array array[
    'iam.role_templates'::regclass,
    'iam.role_template_grants'::regclass
  ]
  loop
    execute pg_catalog.format('alter table %s enable row level security', v_table);
    execute pg_catalog.format('alter table %s force row level security', v_table);
  end loop;
end
$schoolsafe$;

-- Les 11 modèles de rôles (7 existants + 4 manquants).
insert into iam.role_templates (id, code, label) values
  ('21000000-0000-4000-8000-000000000001', 'admin', 'Administrateur principal'),
  ('21000000-0000-4000-8000-000000000002', 'school_head', 'Chef d''établissement'),
  ('21000000-0000-4000-8000-000000000003', 'pedagogy', 'Responsable pédagogique'),
  ('21000000-0000-4000-8000-000000000004', 'teacher', 'Enseignant'),
  ('21000000-0000-4000-8000-000000000005', 'cashier', 'Agent de caisse'),
  ('21000000-0000-4000-8000-000000000006', 'guard', 'Agent de contrôle d''accès'),
  ('21000000-0000-4000-8000-000000000007', 'parent', 'Parent ou responsable légal'),
  ('21000000-0000-4000-8000-000000000008', 'fee_control', 'Responsable du contrôle des frais'),
  ('21000000-0000-4000-8000-000000000009', 'hr', 'Responsable RH'),
  ('21000000-0000-4000-8000-00000000000a', 'staff', 'Personnel'),
  ('21000000-0000-4000-8000-00000000000b', 'hikvision_admin', 'Administrateur du terminal de pointage')
on conflict (code) do nothing;

-- admin : snapshot EXPLICITE des 60 permissions actuelles (pas de jointure
-- aveugle permanente : cette graine fige le catalogue d'aujourd'hui ; toute
-- permission ajoutée demain exigera une nouvelle version de ce pack).
insert into iam.role_template_grants (template_id, permission_id, default_scope_code)
select t.id, p.id, p.default_scope_code
from iam.role_templates t
cross join iam.permissions p
where t.code = 'admin'
on conflict do nothing;

-- Bloc commun à tous les modèles non-admin.
create or replace function pg_temp.access_v1_common_codes()
returns text[] language sql immutable as $schoolsafe$
  select array['session.bootstrap','sync.submit','file.upload','file.download','notification.subscribe','safe.assistant.use']
$schoolsafe$;

-- school_head
insert into iam.role_template_grants (template_id, permission_id, default_scope_code)
select t.id, p.id, p.default_scope_code
from iam.role_templates t
join iam.permissions p on p.code = any (
  pg_temp.access_v1_common_codes() || array[
    'pilotage.dashboard.read','pilotage.alerts.read','pilotage.alerts.manage',
    'pilotage.approvals.read','pilotage.approvals.manage',
    'school.class.read','school.student.read','school.guardian.read',
    'staff.read','staff.attendance.read',
    'pedagogy.report.read','palmarques.read',
    'finance.report.read','finance.status.read','security.events.read',
    'reports.operational.read','reports.financial.read','reports.security.read','reports.hr.read',
    'communication.announcement.manage','communication.message.send','email.send'
  ])
where t.code = 'school_head'
on conflict do nothing;

-- pedagogy (responsable pédagogique)
insert into iam.role_template_grants (template_id, permission_id, default_scope_code)
select t.id, p.id, p.default_scope_code
from iam.role_templates t
join iam.permissions p on p.code = any (
  pg_temp.access_v1_common_codes() || array[
    'pedagogy.subject.read','pedagogy.subject.manage',
    'pedagogy.assignment.read','pedagogy.assignment.manage',
    'pedagogy.grade.read','pedagogy.grade.manage',
    'pedagogy.lesson-plan.read','pedagogy.lesson-plan.manage',
    'pedagogy.report.read','pedagogy.report.manage',
    'palmarques.read','palmarques.manage',
    'school.class.read','school.student.read','school.guardian.read',
    'finance.status.read',
    'pilotage.dashboard.read','pilotage.alerts.read','reports.operational.read'
  ])
where t.code = 'pedagogy'
on conflict do nothing;

-- teacher
insert into iam.role_template_grants (template_id, permission_id, default_scope_code)
select t.id, p.id, p.default_scope_code
from iam.role_templates t
join iam.permissions p on p.code = any (
  pg_temp.access_v1_common_codes() || array[
    'pedagogy.subject.read','pedagogy.assignment.read','pedagogy.assignment.manage',
    'pedagogy.grade.read','pedagogy.grade.manage',
    'pedagogy.lesson-plan.read','pedagogy.lesson-plan.manage',
    'school.class.read','school.student.read','school.guardian.read',
    'palmarques.read','pilotage.alerts.read'
  ])
where t.code = 'teacher'
on conflict do nothing;

-- cashier : la caisse encaisse ; l'annulation est CONDITIONNÉE
-- (within_cancellation_window, 24 h) — jamais libre.
insert into iam.role_template_grants (template_id, permission_id, default_scope_code, condition_code, condition_params)
select t.id, p.id, p.default_scope_code,
  case when p.code = 'finance.payment.cancel' then 'within_cancellation_window' else null end,
  case when p.code = 'finance.payment.cancel' then '{"max_age_hours":24}'::jsonb else '{}'::jsonb end
from iam.role_templates t
join iam.permissions p on p.code = any (
  pg_temp.access_v1_common_codes() || array[
    'finance.fee.read','finance.payment.record','finance.payment.cancel',
    'finance.receipt.read','finance.report.read',
    'finance.cash_register.close','finance.status.read','pilotage.dashboard.read'
  ])
where t.code = 'cashier'
on conflict do nothing;

-- guard : scanner, pick-up, historique du poste — rien de financier.
insert into iam.role_template_grants (template_id, permission_id, default_scope_code)
select t.id, p.id, p.default_scope_code
from iam.role_templates t
join iam.permissions p on p.code = any (
  pg_temp.access_v1_common_codes() || array[
    'security.scan','security.pickup.read','security.pickup.manage','security.events.read'
  ])
where t.code = 'guard'
on conflict do nothing;

-- parent : CORRECTION — palmarès borné à own_children (jamais school).
insert into iam.role_template_grants (template_id, permission_id, default_scope_code)
select t.id, p.id,
  case when p.code = 'palmarques.read' then 'own_children' else p.default_scope_code end
from iam.role_templates t
join iam.permissions p on p.code = any (
  pg_temp.access_v1_common_codes() || array[
    'pedagogy.grade.read','pedagogy.assignment.read','palmarques.read',
    'finance.receipt.read','finance.status.read',
    'security.pickup.read','school.guardian.read'
  ])
where t.code = 'parent'
on conflict do nothing;

-- fee_control (NOUVEAU rôle) : contrôle des frais, campagnes, anomalies.
insert into iam.role_template_grants (template_id, permission_id, default_scope_code)
select t.id, p.id, p.default_scope_code
from iam.role_templates t
join iam.permissions p on p.code = any (
  pg_temp.access_v1_common_codes() || array[
    'finance.control.read','finance.control.manage','finance.control.scan',
    'finance.fee.read','finance.status.read','finance.report.read','pilotage.dashboard.read'
  ])
where t.code = 'fee_control'
on conflict do nothing;

-- hr (NOUVEAU rôle) : personnel et présences, lecture rapports RH.
insert into iam.role_template_grants (template_id, permission_id, default_scope_code)
select t.id, p.id, p.default_scope_code
from iam.role_templates t
join iam.permissions p on p.code = any (
  pg_temp.access_v1_common_codes() || array[
    'staff.read','staff.attendance.read','reports.hr.read'
  ])
where t.code = 'hr'
on conflict do nothing;

-- staff (NOUVEAU rôle) : socle propre uniquement.
insert into iam.role_template_grants (template_id, permission_id, default_scope_code)
select t.id, p.id, p.default_scope_code
from iam.role_templates t
join iam.permissions p on p.code = any (pg_temp.access_v1_common_codes())
where t.code = 'staff'
on conflict do nothing;

-- hikvision_admin (NOUVEAU rôle) : présences du personnel en lecture.
-- La permission d'écriture de pointage est PERMISSION_FUTURE (lot BIO-01) :
-- aucune permission inventée ici (verrou du catalogue).
insert into iam.role_template_grants (template_id, permission_id, default_scope_code)
select t.id, p.id, p.default_scope_code
from iam.role_templates t
join iam.permissions p on p.code = any (
  pg_temp.access_v1_common_codes() || array['staff.attendance.read'])
where t.code = 'hikvision_admin'
on conflict do nothing;

-- ACL : aucun accès direct aux tables de référence pour les rôles applicatifs.
revoke all on iam.role_templates from schoolsafe_api;
revoke all on iam.role_template_grants from schoolsafe_api;
revoke all on iam.role_templates from schoolsafe_auth;
revoke all on iam.role_template_grants from schoolsafe_auth;

commit;
