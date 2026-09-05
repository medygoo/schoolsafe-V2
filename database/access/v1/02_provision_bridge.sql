\set ON_ERROR_STOP on

-- SchoolSafe Access v1 — unité 02 : le pont déterministe.
-- role_templates / role_template_grants → iam.roles → iam.role_permission_grants
-- → iam.grant_scopes → iam.permission_conditions, pour une école donnée.
-- Gouverné par Access_Law : contexte valide + permission roles.manage + audit.

begin;
set local role schoolsafe_owner;

create or replace function api.school_provision_roles(p_school_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $schoolsafe$
declare
  v_school_id uuid := iam.current_school_id();
  v_profile_id uuid := iam.current_profile_id();
  v_template record;
  v_grant record;
  v_role_id uuid;
  v_grant_id uuid;
  v_roles integer := 0;
  v_grants integer := 0;
begin
  perform iam.require_access('roles.manage');

  if p_school_id is null or p_school_id <> v_school_id then
    raise foreign_key_violation using message = 'School does not match the active context';
  end if;

  if not exists (select 1 from app.schools s where s.id = v_school_id) then
    raise foreign_key_violation using message = 'Unknown school';
  end if;

  for v_template in
    select t.id, t.code, t.label
    from iam.role_templates t
    where t.is_active = true
    order by t.code
  loop
    insert into iam.roles (school_id, code, label, created_by)
    select v_school_id, v_template.code, v_template.label, v_profile_id
    where not exists (
      select 1 from iam.roles r
      where r.school_id = v_school_id and r.code = v_template.code
    )
    returning id into v_role_id;

    if v_role_id is null then
      select r.id into v_role_id from iam.roles r
      where r.school_id = v_school_id and r.code = v_template.code;
    else
      v_roles := v_roles + 1;
    end if;

    for v_grant in
      select g.permission_id, g.default_scope_code, g.condition_code, g.condition_params
      from iam.role_template_grants g
      where g.template_id = v_template.id
    loop
      insert into iam.role_permission_grants (
        school_id, role_id, permission_id, effect, reason, granted_by
      )
      select v_school_id, v_role_id, v_grant.permission_id, 'allow',
        'Provisionné depuis le modèle ' || v_template.code, v_profile_id
      where not exists (
        select 1 from iam.role_permission_grants g2
        where g2.school_id = v_school_id
          and g2.role_id = v_role_id
          and g2.permission_id = v_grant.permission_id
      )
      returning id into v_grant_id;

      if v_grant_id is not null then
        v_grants := v_grants + 1;

        insert into iam.grant_scopes (school_id, grant_id, scope_code, target_id, assigned_by)
        values (v_school_id, v_grant_id, v_grant.default_scope_code, null, v_profile_id);

        if v_grant.condition_code is not null then
          insert into iam.permission_conditions (
            school_id, grant_id, condition_code, condition_params, created_by
          ) values (
            v_school_id, v_grant_id, v_grant.condition_code, v_grant.condition_params, v_profile_id
          );
        end if;
      end if;
    end loop;
  end loop;

  perform audit.write_event(
    'school.roles.provisioned',
    'school',
    v_school_id,
    jsonb_build_object(
      'actor_profile_id', v_profile_id,
      'roles_created', v_roles,
      'grants_created', v_grants
    )
  );

  return jsonb_build_object(
    'school_id', v_school_id,
    'roles_created', v_roles,
    'grants_created', v_grants
  );
end
$schoolsafe$;

grant execute on function api.school_provision_roles(uuid) to schoolsafe_api;

commit;
