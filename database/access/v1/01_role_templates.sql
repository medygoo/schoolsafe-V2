\set ON_ERROR_STOP on

-- SchoolSafe Access v1 R2 — MATRICE EXPLICITE rôle × permission × portée × condition.
-- Aucune portée n'est héritée silencieusement du catalogue : chaque ligne de
-- grant est une décision écrite. Admin = snapshot figé des 60 codes (toute
-- permission future exigera une nouvelle version de ce pack).
--
-- Tables de référence globales à l'environnement : graines d'abord, puis
-- FORCE RLS sans policy en dernier (comme la baseline), aucun accès direct
-- aux rôles applicatifs.

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

-- ════════════════════════════════════════════════════════════════════════
-- ADMIN — snapshot figé : les 60 codes, un par un, écrits à la main.
-- Une permission FUTURE ne sera jamais absorbée par un simple rejeu.
-- ════════════════════════════════════════════════════════════════════════
insert into iam.role_template_grants (template_id, permission_id, default_scope_code)
select t.id, p.id, v.scope_code
from (values
  ('session.bootstrap','none'),('school.class.read','school'),('school.student.read','school'),
  ('school.student.create','school'),('school.guardian.read','school'),('school.guardian.manage','school'),
  ('school.manage','school'),('staff.manage','school'),('roles.manage','school'),
  ('security.pickup.read','school'),('security.pickup.manage','school'),('security.scan','school'),
  ('security.lockdown.manage','school'),('security.events.read','school'),('security.card.create','school'),
  ('cards.request.print','school'),('pilotage.dashboard.read','school'),('pilotage.alerts.read','school'),
  ('pilotage.alerts.manage','school'),('pilotage.approvals.read','own'),('pilotage.approvals.manage','school'),
  ('email.send','school'),('finance.fee.read','school'),('finance.fee.manage','school'),
  ('finance.payment.record','school'),('finance.payment.cancel','school'),
  ('finance.receipt.read','school'),('finance.report.read','school'),('finance.cash_register.close','school'),
  ('finance.control.read','school'),('finance.control.manage','school'),('finance.control.scan','school'),
  ('finance.status.read','school'),('pedagogy.subject.read','school'),('pedagogy.subject.manage','school'),
  ('pedagogy.assignment.read','school'),('pedagogy.assignment.manage','school'),('pedagogy.grade.read','school'),
  ('pedagogy.grade.manage','school'),('pedagogy.lesson-plan.read','school'),('pedagogy.lesson-plan.manage','school'),
  ('pedagogy.report.read','school'),('pedagogy.report.manage','school'),('palmarques.read','school'),
  ('palmarques.manage','school'),('staff.read','school'),('staff.attendance.read','school'),
  ('canteen.manage','school'),('infirmary.manage','school'),('communication.announcement.manage','school'),
  ('communication.message.send','school'),('notification.subscribe','own'),('safe.assistant.use','own'),
  ('reports.operational.read','school'),('reports.financial.read','school'),('reports.security.read','school'),
  ('reports.hr.read','school'),('sync.submit','own'),('file.upload','own'),('file.download','own')
) as v(permission_code, scope_code)
cross join iam.role_templates t
join iam.permissions p on p.code = v.permission_code
where t.code = 'admin'
on conflict do nothing;

-- ═══ SCHOOL_HEAD (Direction) — supervision en lecture, portée school décidée.
insert into iam.role_template_grants (template_id, permission_id, default_scope_code)
select t.id, p.id, v.scope_code
from (values
  ('session.bootstrap','none'),('sync.submit','own'),('file.upload','own'),
  ('file.download','own'),('notification.subscribe','own'),('safe.assistant.use','own'),
  ('pilotage.dashboard.read','school'),('pilotage.alerts.read','school'),('pilotage.alerts.manage','school'),
  ('pilotage.approvals.read','own'),('pilotage.approvals.manage','school'),
  ('school.class.read','school'),('school.student.read','school'),('school.guardian.read','school'),
  ('staff.read','school'),('staff.attendance.read','school'),
  ('pedagogy.report.read','school'),('palmarques.read','school'),
  ('finance.report.read','school'),('finance.status.read','school'),('security.events.read','school'),
  ('reports.operational.read','school'),('reports.financial.read','school'),('reports.security.read','school'),
  ('reports.hr.read','school'),('communication.announcement.manage','school'),('communication.message.send','school'),
  ('email.send','school')
) as v(permission_code, scope_code)
cross join iam.role_templates t
join iam.permissions p on p.code = v.permission_code
where t.code = 'school_head'
on conflict do nothing;

-- ═══ PEDAGOGY (Responsable pédagogique) — toute la pédagogie, portée school.
insert into iam.role_template_grants (template_id, permission_id, default_scope_code)
select t.id, p.id, v.scope_code
from (values
  ('session.bootstrap','none'),('sync.submit','own'),('file.upload','own'),
  ('file.download','own'),('notification.subscribe','own'),('safe.assistant.use','own'),
  ('pedagogy.subject.read','school'),('pedagogy.subject.manage','school'),
  ('pedagogy.assignment.read','school'),('pedagogy.assignment.manage','school'),
  ('pedagogy.grade.read','school'),('pedagogy.grade.manage','school'),
  ('pedagogy.lesson-plan.read','school'),('pedagogy.lesson-plan.manage','school'),
  ('pedagogy.report.read','school'),('pedagogy.report.manage','school'),
  ('palmarques.read','school'),('palmarques.manage','school'),
  ('school.class.read','school'),('school.student.read','school'),('school.guardian.read','school'),
  ('finance.status.read','school'),
  ('pilotage.dashboard.read','school'),('pilotage.alerts.read','school'),('reports.operational.read','school')
) as v(permission_code, scope_code)
cross join iam.role_templates t
join iam.permissions p on p.code = v.permission_code
where t.code = 'pedagogy'
on conflict do nothing;

-- ═══ TEACHER — ses classes et ses matières, jamais own_children.
insert into iam.role_template_grants (template_id, permission_id, default_scope_code)
select t.id, p.id, v.scope_code
from (values
  ('session.bootstrap','none'),('sync.submit','own'),('file.upload','own'),
  ('file.download','own'),('notification.subscribe','own'),('safe.assistant.use','own'),
  ('pedagogy.subject.read','assigned_subjects'),
  ('pedagogy.assignment.read','assigned_classes'),('pedagogy.assignment.manage','assigned_classes'),
  ('pedagogy.grade.read','assigned_classes'),('pedagogy.grade.manage','assigned_classes'),
  ('pedagogy.lesson-plan.read','assigned_classes'),('pedagogy.lesson-plan.manage','assigned_classes'),
  ('school.class.read','assigned_classes'),('school.student.read','assigned_classes'),
  ('school.guardian.read','assigned_classes'),
  ('palmarques.read','assigned_classes'),('pilotage.alerts.read','assigned_classes')
) as v(permission_code, scope_code)
cross join iam.role_templates t
join iam.permissions p on p.code = v.permission_code
where t.code = 'teacher'
on conflict do nothing;

-- ═══ CASHIER — caisse à portée school ; annulation CONDITIONNÉE (24 h).
insert into iam.role_template_grants (
  template_id, permission_id, default_scope_code, condition_code, condition_params
)
select t.id, p.id, v.scope_code, v.condition_code, coalesce(v.condition_params::jsonb, '{}'::jsonb)
from (values
  ('session.bootstrap','none',null,null),('sync.submit','own',null,null),
  ('file.upload','own',null,null),('file.download','own',null,null),
  ('notification.subscribe','own',null,null),('safe.assistant.use','own',null,null),
  ('finance.fee.read','school',null,null),('finance.payment.record','school',null,null),
  ('finance.payment.cancel','school','within_cancellation_window','{"max_age_hours":24}'),
  ('finance.receipt.read','school',null,null),('finance.report.read','school',null,null),
  ('finance.cash_register.close','school',null,null),('finance.status.read','school',null,null),
  ('pilotage.dashboard.read','school',null,null)
) as v(permission_code, scope_code, condition_code, condition_params)
cross join iam.role_templates t
join iam.permissions p on p.code = v.permission_code
where t.code = 'cashier'
on conflict do nothing;

-- ═══ GUARD — son portail, uniquement son portail.
insert into iam.role_template_grants (template_id, permission_id, default_scope_code)
select t.id, p.id, v.scope_code
from (values
  ('session.bootstrap','none'),('sync.submit','own'),('file.upload','own'),
  ('file.download','own'),('notification.subscribe','own'),('safe.assistant.use','own'),
  ('security.scan','assigned_portal'),('security.pickup.read','assigned_portal'),
  ('security.pickup.manage','assigned_portal'),('security.events.read','assigned_portal')
) as v(permission_code, scope_code)
cross join iam.role_templates t
join iam.permissions p on p.code = v.permission_code
where t.code = 'guard'
on conflict do nothing;

-- ═══ PARENT — own_children partout, sans exception.
insert into iam.role_template_grants (template_id, permission_id, default_scope_code)
select t.id, p.id, v.scope_code
from (values
  ('session.bootstrap','none'),('sync.submit','own'),('file.upload','own'),
  ('file.download','own'),('notification.subscribe','own'),('safe.assistant.use','own'),
  ('pedagogy.grade.read','own_children'),('pedagogy.assignment.read','own_children'),
  ('palmarques.read','own_children'),
  ('finance.receipt.read','own_children'),('finance.status.read','own_children'),
  ('security.pickup.read','own_children'),('school.guardian.read','own_children')
) as v(permission_code, scope_code)
cross join iam.role_templates t
join iam.permissions p on p.code = v.permission_code
where t.code = 'parent'
on conflict do nothing;

-- ═══ FEE_CONTROL (nouveau) — campagnes et contrôle, scan par classe.
insert into iam.role_template_grants (template_id, permission_id, default_scope_code)
select t.id, p.id, v.scope_code
from (values
  ('session.bootstrap','none'),('sync.submit','own'),('file.upload','own'),
  ('file.download','own'),('notification.subscribe','own'),('safe.assistant.use','own'),
  ('finance.control.read','school'),('finance.control.manage','school'),
  ('finance.control.scan','assigned_classes'),
  ('finance.fee.read','school'),('finance.status.read','school'),
  ('finance.report.read','school'),('pilotage.dashboard.read','school')
) as v(permission_code, scope_code)
cross join iam.role_templates t
join iam.permissions p on p.code = v.permission_code
where t.code = 'fee_control'
on conflict do nothing;

-- ═══ HR (nouveau) — personnel et présences.
insert into iam.role_template_grants (template_id, permission_id, default_scope_code)
select t.id, p.id, v.scope_code
from (values
  ('session.bootstrap','none'),('sync.submit','own'),('file.upload','own'),
  ('file.download','own'),('notification.subscribe','own'),('safe.assistant.use','own'),
  ('staff.read','school'),('staff.attendance.read','school'),('reports.hr.read','school')
) as v(permission_code, scope_code)
cross join iam.role_templates t
join iam.permissions p on p.code = v.permission_code
where t.code = 'hr'
on conflict do nothing;

-- ═══ STAFF (nouveau) — socle propre uniquement.
insert into iam.role_template_grants (template_id, permission_id, default_scope_code)
select t.id, p.id, v.scope_code
from (values
  ('session.bootstrap','none'),('sync.submit','own'),('file.upload','own'),
  ('file.download','own'),('notification.subscribe','own'),('safe.assistant.use','own')
) as v(permission_code, scope_code)
cross join iam.role_templates t
join iam.permissions p on p.code = v.permission_code
where t.code = 'staff'
on conflict do nothing;

-- ═══ HIKVISION_ADMIN (nouveau) — présences du personnel en lecture.
-- Aucune permission biométrique n'existe dans le catalogue : PERMISSION_FUTURE
-- (lot BIO-01) — rien n'est inventé ici.
insert into iam.role_template_grants (template_id, permission_id, default_scope_code)
select t.id, p.id, v.scope_code
from (values
  ('session.bootstrap','none'),('sync.submit','own'),('file.upload','own'),
  ('file.download','own'),('notification.subscribe','own'),('safe.assistant.use','own'),
  ('staff.attendance.read','school')
) as v(permission_code, scope_code)
cross join iam.role_templates t
join iam.permissions p on p.code = v.permission_code
where t.code = 'hikvision_admin'
on conflict do nothing;

-- ACL : aucun accès direct aux tables de référence pour les rôles applicatifs.
revoke all on iam.role_templates from schoolsafe_api;
revoke all on iam.role_template_grants from schoolsafe_api;
revoke all on iam.role_templates from schoolsafe_auth;
revoke all on iam.role_template_grants from schoolsafe_auth;

-- Défense en profondeur EN DERNIER (après les graines, comme la baseline) :
-- RLS activée et forcée, sans aucune policy → accès direct impossible pour
-- tous les rôles ; la lecture se fera via des fonctions autorisées futures.
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

commit;
