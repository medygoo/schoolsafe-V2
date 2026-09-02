\set ON_ERROR_STOP on

begin;
set local role schoolsafe_owner;

do $schoolsafe$
declare
  v_missing text[];
  v_count integer;
begin
  if pg_catalog.current_setting('server_version_num')::integer <> 170011 then
    raise exception 'Verification requires PostgreSQL 17.11';
  end if;

  if not (
    'pg_stat_statements' = any(
      pg_catalog.regexp_split_to_array(
        pg_catalog.current_setting('shared_preload_libraries'),
        '\\s*,\\s*'
      )
    )
  ) then
    raise exception 'pg_stat_statements is not preloaded';
  end if;

  if pg_catalog.current_setting('compute_query_id') not in ('auto', 'on') then
    raise exception 'compute_query_id must be auto or on';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_extension e
    join pg_catalog.pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pg_stat_statements'
      and n.nspname = 'ops'
  ) then
    raise exception 'pg_stat_statements extension is missing from ops';
  end if;

  select pg_catalog.array_agg(required_schema order by required_schema)
  into v_missing
  from pg_catalog.unnest(array['app', 'iam', 'audit', 'ops', 'api', 'legacy_cloud', 'auth']) required_schema
  where not exists (
    select 1 from pg_catalog.pg_namespace n where n.nspname = required_schema
  );
  if v_missing is not null then
    raise exception 'Missing schemas: %', v_missing;
  end if;

  select pg_catalog.count(*) into v_count
  from pg_catalog.pg_roles
  where rolname in (
    'schoolsafe_owner',
    'schoolsafe_migrator',
    'schoolsafe_api',
    'schoolsafe_worker',
    'schoolsafe_auditor'
  )
    and not rolsuper
    and not rolcreatedb
    and not rolcreaterole
    and not rolreplication
    and not rolbypassrls;
  if v_count <> 5 then
    raise exception 'SchoolSafe SQL role hardening mismatch';
  end if;

  select pg_catalog.count(*) into v_count from iam.permissions;
  if v_count <> 60 then
    raise exception 'Expected exactly 60 permissions, found %', v_count;
  end if;

  select pg_catalog.count(*) into v_count from iam.scopes;
  if v_count <> 7 then
    raise exception 'Expected exactly 7 scopes, found %', v_count;
  end if;

  if exists (
    select 1
    from iam.scopes s
    where s.code not in (
      'own',
      'own_children',
      'assigned_classes',
      'assigned_subjects',
      'assigned_portal',
      'school',
      'none'
    )
  ) then
    raise exception 'Non-canonical scope detected';
  end if;

  if iam.current_user_id() is not null
     or iam.current_profile_id() is not null
     or iam.current_school_id() is not null
     or iam.current_request_id() is not null
     or iam.context_is_valid()
     or iam.can_access('school.manage') then
    raise exception 'Missing transaction context must deny by default';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('app', 'iam', 'audit', 'ops', 'api')
      and pg_catalog.lower(pg_catalog.pg_get_functiondef(p.oid)) like ('%auth.' || 'uid(%')
  ) then
    raise exception 'Forbidden Supabase identity-function dependency detected';
  end if;

  select pg_catalog.array_agg(rpc_name order by rpc_name)
  into v_missing
  from pg_catalog.unnest(array[
    'deactivate_other_academic_years',
    'next_document_number',
    'ensure_receipt_number',
    'record_payment',
    'cancel_payment',
    'increment_card_print_count',
    'create_student_draft',
    'compensate_student_draft_creation'
  ]) rpc_name
  where not exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'api' and p.proname = rpc_name and p.prosecdef
  );
  if v_missing is not null then
    raise exception 'Missing or non-definer P0 RPCs: %', v_missing;
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'api'
      and p.proname in (
        'deactivate_other_academic_years',
        'next_document_number',
        'ensure_receipt_number',
        'record_payment',
        'cancel_payment',
        'increment_card_print_count',
        'create_student_draft',
        'compensate_student_draft_creation'
      )
      and not coalesce(
        p.proconfig @> array['search_path=pg_catalog'],
        false
      )
  ) then
    raise exception 'A P0 RPC has an unsafe search_path';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) acl
    where n.nspname in ('app', 'iam', 'audit', 'ops', 'api')
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'PUBLIC execute privilege detected on SchoolSafe function';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('app', 'iam', 'audit', 'ops')
      and c.relkind in ('r', 'p')
      and (
        pg_catalog.has_table_privilege('schoolsafe_api', c.oid, 'select')
        or pg_catalog.has_table_privilege('schoolsafe_api', c.oid, 'insert')
        or pg_catalog.has_table_privilege('schoolsafe_api', c.oid, 'update')
        or pg_catalog.has_table_privilege('schoolsafe_api', c.oid, 'delete')
      )
  ) then
    raise exception 'schoolsafe_api must not have direct table privileges';
  end if;

  select pg_catalog.array_agg(required_table order by required_table)
  into v_missing
  from pg_catalog.unnest(array[
    'app.cash_registers',
    'app.security_portals',
    'iam.permission_conditions',
    'ops.document_number_sequences'
  ]) required_table
  where not exists (
    select 1
    from pg_catalog.pg_class c
    where c.oid = pg_catalog.to_regclass(required_table)
      and c.relrowsecurity
      and c.relforcerowsecurity
  );
  if v_missing is not null then
    raise exception 'Required forced-RLS tables missing or unprotected: %', v_missing;
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_attribute a
      on a.attrelid = c.oid
     and a.attname = 'school_id'
     and a.attnum > 0
     and not a.attisdropped
    where n.nspname in ('app', 'iam', 'audit', 'ops')
      and c.relkind in ('r', 'p')
      and (not c.relrowsecurity or not c.relforcerowsecurity)
  ) then
    raise exception 'Tenant-aware table without forced RLS detected';
  end if;

  select pg_catalog.count(*) into v_count
  from ops.schema_versions v
  where v.baseline_version = 'schoolsafe-vps-v1';
  if v_count not between 12 and 13 then
    raise exception 'Expected 12 or 13 recorded baseline units at verification time, found %', v_count;
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'auth' and c.relkind in ('r', 'p', 'v', 'm', 'S')
  ) then
    raise exception 'Auth migration must remain separate from the business baseline';
  end if;
end
$schoolsafe$;

select jsonb_build_object(
  'baseline_version', 'schoolsafe-vps-v1',
  'postgresql', pg_catalog.current_setting('server_version'),
  'pg_stat_statements', 'preloaded-and-installed',
  'permissions', (select pg_catalog.count(*) from iam.permissions),
  'scopes', (select pg_catalog.count(*) from iam.scopes),
  'p0_rpc', 8,
  'forced_rls_tables', (
    select pg_catalog.count(*)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('app', 'iam', 'audit', 'ops')
      and c.relkind in ('r', 'p')
      and c.relrowsecurity
      and c.relforcerowsecurity
  ),
  'status', 'PASS'
) as schoolsafe_baseline_verification;

commit;
