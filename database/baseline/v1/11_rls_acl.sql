\set ON_ERROR_STOP on

begin;
set local role schoolsafe_owner;

do $schoolsafe$
declare
  v_table regclass;
  v_policy_name text;
begin
  foreach v_table in array array[
    'app.schools'::regclass,
    'app.school_settings'::regclass,
    'app.academic_years'::regclass,
    'app.school_cycles'::regclass,
    'app.school_contacts'::regclass,
    'app.classes'::regclass,
    'app.students'::regclass,
    'app.student_guardians'::regclass,
    'app.student_enrollments'::regclass,
    'app.student_enrollment_events'::regclass,
    'app.parent_invitations'::regclass,
    'app.card_print_requests'::regclass,
    'app.locations'::regclass,
    'app.security_portals'::regclass,
    'app.student_cards'::regclass,
    'app.security_events'::regclass,
    'app.alert_rules'::regclass,
    'app.alerts'::regclass,
    'app.alert_notifications'::regclass,
    'app.fee_structures'::regclass,
    'app.student_fees'::regclass,
    'app.cash_registers'::regclass,
    'app.fee_payments'::regclass,
    'app.cash_register_closures'::regclass,
    'app.fee_control_campaigns'::regclass,
    'app.fee_control_assignees'::regclass,
    'app.fee_control_scans'::regclass,
    'app.subjects'::regclass,
    'app.teacher_assignments'::regclass,
    'app.assignments'::regclass,
    'app.assignment_questions'::regclass,
    'app.grades'::regclass,
    'app.lesson_plans'::regclass,
    'app.approval_requests'::regclass,
    'app.rankings'::regclass,
    'app.ranking_entries'::regclass,
    'app.ranking_stars'::regclass
  ]
  loop
    execute pg_catalog.format('alter table %s enable row level security', v_table);
    execute pg_catalog.format('alter table %s force row level security', v_table);
    v_policy_name := pg_catalog.replace(v_table::text, '.', '_') || '_owner_tenant';
    execute pg_catalog.format('drop policy if exists %I on %s', v_policy_name, v_table);

    if v_table = 'app.schools'::regclass then
      execute pg_catalog.format(
        'create policy %I on %s for all to schoolsafe_owner using (id = iam.current_school_id() and iam.context_is_valid()) with check (id = iam.current_school_id() and iam.context_is_valid())',
        v_policy_name,
        v_table
      );
    else
      execute pg_catalog.format(
        'create policy %I on %s for all to schoolsafe_owner using (school_id = iam.current_school_id() and iam.context_is_valid()) with check (school_id = iam.current_school_id() and iam.context_is_valid())',
        v_policy_name,
        v_table
      );
    end if;
  end loop;
end
$schoolsafe$;

do $schoolsafe$
declare
  v_table regclass;
  v_policy_name text;
begin
  foreach v_table in array array[
    'iam.profiles'::regclass,
    'iam.devices'::regclass,
    'iam.roles'::regclass,
    'iam.profile_roles'::regclass,
    'iam.role_permission_grants'::regclass,
    'iam.permission_conditions'::regclass,
    'iam.profile_permission_exceptions'::regclass,
    'iam.scope_assignments'::regclass
  ]
  loop
    execute pg_catalog.format('alter table %s enable row level security', v_table);
    execute pg_catalog.format('alter table %s force row level security', v_table);
    v_policy_name := pg_catalog.replace(v_table::text, '.', '_') || '_owner_tenant';
    execute pg_catalog.format('drop policy if exists %I on %s', v_policy_name, v_table);
    execute pg_catalog.format(
      'create policy %I on %s for all to schoolsafe_owner using (school_id = iam.current_school_id()) with check (school_id = iam.current_school_id())',
      v_policy_name,
      v_table
    );
  end loop;
end
$schoolsafe$;

alter table audit.events enable row level security;
alter table audit.events force row level security;
drop policy if exists audit_events_owner_tenant on audit.events;
create policy audit_events_owner_tenant
on audit.events
for all
to schoolsafe_owner
using (school_id = iam.current_school_id() and iam.context_is_valid())
with check (school_id = iam.current_school_id() and iam.context_is_valid());

drop policy if exists audit_events_auditor_tenant on audit.events;
create policy audit_events_auditor_tenant
on audit.events
for select
to schoolsafe_auditor
using (school_id = iam.current_school_id() and iam.context_is_valid());

do $schoolsafe$
declare
  v_table regclass;
  v_policy_name text;
begin
  foreach v_table in array array[
    'ops.system_events'::regclass,
    'ops.notifications'::regclass,
    'ops.document_number_sequences'::regclass,
    'ops.indicator_snapshots'::regclass
  ]
  loop
    execute pg_catalog.format('alter table %s enable row level security', v_table);
    execute pg_catalog.format('alter table %s force row level security', v_table);
    v_policy_name := pg_catalog.replace(v_table::text, '.', '_') || '_owner_tenant';
    execute pg_catalog.format('drop policy if exists %I on %s', v_policy_name, v_table);
    execute pg_catalog.format(
      'create policy %I on %s for all to schoolsafe_owner using (school_id = iam.current_school_id() and iam.context_is_valid()) with check (school_id = iam.current_school_id() and iam.context_is_valid())',
      v_policy_name,
      v_table
    );
  end loop;
end
$schoolsafe$;

alter table ops.notification_templates enable row level security;
alter table ops.notification_templates force row level security;
drop policy if exists notification_templates_owner_read on ops.notification_templates;
create policy notification_templates_owner_read
on ops.notification_templates
for select
to schoolsafe_owner
using (iam.context_is_valid() and (school_id is null or school_id = iam.current_school_id()));
drop policy if exists notification_templates_owner_write on ops.notification_templates;
create policy notification_templates_owner_write
on ops.notification_templates
for all
to schoolsafe_owner
using (iam.context_is_valid() and school_id = iam.current_school_id())
with check (iam.context_is_valid() and school_id = iam.current_school_id());

alter table ops.data_retention_policies enable row level security;
alter table ops.data_retention_policies force row level security;
drop policy if exists retention_policies_owner_read on ops.data_retention_policies;
create policy retention_policies_owner_read
on ops.data_retention_policies
for select
to schoolsafe_owner
using (iam.context_is_valid() and (school_id is null or school_id = iam.current_school_id()));
drop policy if exists retention_policies_owner_write on ops.data_retention_policies;
create policy retention_policies_owner_write
on ops.data_retention_policies
for all
to schoolsafe_owner
using (iam.context_is_valid() and school_id = iam.current_school_id())
with check (iam.context_is_valid() and school_id = iam.current_school_id());

drop policy if exists system_events_worker_tenant on ops.system_events;
create policy system_events_worker_tenant
on ops.system_events
for all
to schoolsafe_worker
using (school_id = iam.current_school_id() and iam.context_is_valid())
with check (school_id = iam.current_school_id() and iam.context_is_valid());

drop policy if exists notifications_worker_tenant on ops.notifications;
create policy notifications_worker_tenant
on ops.notifications
for all
to schoolsafe_worker
using (school_id = iam.current_school_id() and iam.context_is_valid())
with check (school_id = iam.current_school_id() and iam.context_is_valid());

revoke all on all tables in schema app from public;
revoke all on all tables in schema iam from public;
revoke all on all tables in schema audit from public;
revoke all on
  ops.schema_versions,
  ops.system_events,
  ops.notification_templates,
  ops.notifications,
  ops.data_retention_policies,
  ops.document_number_sequences,
  ops.indicator_snapshots
from public;
revoke all on all sequences in schema app from public;
revoke all on all sequences in schema iam from public;
revoke all on all sequences in schema audit from public;
revoke all on all sequences in schema ops from public;

revoke all on all tables in schema app from schoolsafe_api;
revoke all on all tables in schema iam from schoolsafe_api;
revoke all on all tables in schema audit from schoolsafe_api;
revoke all on
  ops.schema_versions,
  ops.system_events,
  ops.notification_templates,
  ops.notifications,
  ops.data_retention_policies,
  ops.document_number_sequences,
  ops.indicator_snapshots
from schoolsafe_api;
revoke all on all sequences in schema app from schoolsafe_api;
revoke all on all sequences in schema iam from schoolsafe_api;
revoke all on all sequences in schema audit from schoolsafe_api;
revoke all on all sequences in schema ops from schoolsafe_api;

revoke execute on all functions in schema app from public, schoolsafe_api, schoolsafe_worker, schoolsafe_auditor;
revoke execute on all functions in schema iam from public, schoolsafe_api, schoolsafe_worker, schoolsafe_auditor;
revoke execute on all functions in schema audit from public, schoolsafe_api, schoolsafe_worker, schoolsafe_auditor;
revoke execute on function ops.record_schema_version(smallint, text, text, text, text)
  from public, schoolsafe_api, schoolsafe_worker, schoolsafe_auditor;
revoke execute on all functions in schema api from public, schoolsafe_worker, schoolsafe_auditor;

grant usage on schema api to schoolsafe_api, schoolsafe_worker, schoolsafe_auditor;
grant execute on all functions in schema api to schoolsafe_api;
grant execute on function api.set_request_context(uuid, uuid, uuid, uuid) to schoolsafe_worker, schoolsafe_auditor;

grant usage on schema iam to schoolsafe_worker, schoolsafe_auditor;
grant execute on function iam.current_school_id() to schoolsafe_worker, schoolsafe_auditor;
grant execute on function iam.context_is_valid() to schoolsafe_worker, schoolsafe_auditor;

grant usage on schema ops to schoolsafe_worker;
grant select, update on ops.system_events, ops.notifications to schoolsafe_worker;

grant usage on schema audit to schoolsafe_auditor;
grant select on audit.events to schoolsafe_auditor;

grant usage on schema ops to schoolsafe_migrator;
grant select, insert on ops.schema_versions to schoolsafe_migrator;
grant execute on function ops.record_schema_version(smallint, text, text, text, text) to schoolsafe_migrator;

do $schoolsafe$
declare
  v_database name := pg_catalog.current_database();
begin
  execute pg_catalog.format('revoke all on database %I from public', v_database);
  execute pg_catalog.format('revoke temporary on database %I from public', v_database);
  execute pg_catalog.format(
    'grant connect on database %I to schoolsafe_owner, schoolsafe_migrator, schoolsafe_api, schoolsafe_worker, schoolsafe_auditor',
    v_database
  );
end
$schoolsafe$;

commit;
