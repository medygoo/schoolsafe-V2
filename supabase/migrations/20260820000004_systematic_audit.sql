-- SchoolSafe V2 — C4 : Audit systématique des opérations sensibles et des tentatives refusées
-- Extension du modèle d'autorisation USER → SCHOOL → ROLE → PERMISSION → SCOPE → CONDITION → EXCEPTION → AUDIT.

-- ============================================================
-- 1. Schéma : enrichissement de audit_events
-- ============================================================

alter table public.audit_events
  add column if not exists success boolean not null default true,
  add column if not exists target_profile_id uuid references public.profiles(id) on delete set null;

comment on column public.audit_events.success is 'Indique si l action a reussi (true) ou si une tentative a ete refusee (false).';
comment on column public.audit_events.target_profile_id is 'Profil cible de l action, quand applicable.';

create index if not exists audit_events_type_school_created_idx
  on public.audit_events (event_type, school_id, created_at desc);

-- ============================================================
-- 2. Fonction helper publique d'insertion d'événement d'audit
-- ============================================================

create or replace function public.audit_event(
  p_event_type text,
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_payload jsonb,
  p_request_id text,
  p_success boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_school_id uuid;
begin
  if p_payload is null then
    p_payload := '{}'::jsonb;
  end if;

  -- Résolution de l'école : d'abord par l'acteur, sinon par la cible.
  select school_id into v_school_id
  from public.profiles
  where id = p_actor_profile_id;

  if v_school_id is null then
    select school_id into v_school_id
    from public.profiles
    where id = p_target_profile_id;
  end if;

  if v_school_id is null then
    raise exception 'Impossible de resoudre school_id pour l evenement d audit %', p_event_type;
  end if;

  insert into public.audit_events (
    school_id,
    actor_profile_id,
    target_profile_id,
    event_type,
    payload,
    request_id,
    success
  ) values (
    v_school_id,
    p_actor_profile_id,
    p_target_profile_id,
    p_event_type,
    p_payload,
    p_request_id,
    p_success
  );
end;
$$;

revoke all on function public.audit_event(text, uuid, uuid, jsonb, text, boolean) from public;
grant execute on function public.audit_event(text, uuid, uuid, jsonb, text, boolean) to authenticated;

-- ============================================================
-- 3. RLS : permettre l'insertion directe depuis authenticated
-- ============================================================

-- La politique audit_events_insert_self existe déjà dans 202608150003_foundation_rls.sql.
-- La fonction audit_event étant SECURITY DEFINER, les triggers et la RPC n'ont pas besoin
-- de droits supplémentaires. On laisse la politique existante active.

-- ============================================================
-- 4. Helper interne : insertion robuste depuis un trigger
-- ============================================================

create or replace function public.audit_event_from_trigger(
  p_event_type text,
  p_actor_profile_id uuid,
  p_target_profile_id uuid,
  p_payload jsonb,
  p_request_id text,
  p_success boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  begin
    perform public.audit_event(
      p_event_type,
      p_actor_profile_id,
      p_target_profile_id,
      p_payload,
      p_request_id,
      p_success
    );
  exception when others then
    raise warning '[audit trigger] failed to log %: %', p_event_type, sqlerrm;
  end;
end;
$$;

revoke all on function public.audit_event_from_trigger(text, uuid, uuid, jsonb, text, boolean) from public;
grant execute on function public.audit_event_from_trigger(text, uuid, uuid, jsonb, text, boolean) to authenticated;

-- ============================================================
-- 5. Trigger : role_permission_grants
-- ============================================================

create or replace function public.audit_role_permission_grants()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_event_type text;
  v_payload jsonb;
  v_permission_code text;
  v_actor_profile_id uuid;
begin
  begin
    if tg_op = 'DELETE' then
      select code into v_permission_code from public.permissions where id = OLD.permission_id;
      v_event_type := 'role.permission.revoked';
      v_payload := jsonb_build_object(
        'role_id', OLD.role_id,
        'permission_id', OLD.permission_id,
        'permission_code', v_permission_code,
        'allowed', OLD.allowed
      );
      v_actor_profile_id := public.current_profile_id();
    else
      select code into v_permission_code from public.permissions where id = NEW.permission_id;
      if tg_op = 'INSERT' then
        v_event_type := case when NEW.allowed then 'role.permission.granted' else 'role.permission.revoked' end;
        v_payload := jsonb_build_object(
          'role_id', NEW.role_id,
          'permission_id', NEW.permission_id,
          'permission_code', v_permission_code,
          'allowed', NEW.allowed
        );
        v_actor_profile_id := public.current_profile_id();
      else
        -- UPDATE
        v_event_type := case when NEW.allowed then 'role.permission.granted' else 'role.permission.revoked' end;
        v_payload := jsonb_build_object(
          'role_id', NEW.role_id,
          'permission_id', NEW.permission_id,
          'permission_code', v_permission_code,
          'allowed', NEW.allowed,
          'previous_allowed', OLD.allowed
        );
        v_actor_profile_id := public.current_profile_id();
      end if;
    end if;

    perform public.audit_event_from_trigger(
      v_event_type,
      v_actor_profile_id,
      null,
      v_payload,
      null,
      true
    );
  exception when others then
    raise warning '[audit_role_permission_grants] failed: %', sqlerrm;
  end;

  return null;
end;
$$;

revoke all on function public.audit_role_permission_grants() from public;
grant execute on function public.audit_role_permission_grants() to authenticated;

drop trigger if exists audit_role_permission_grants on public.role_permission_grants;
create trigger audit_role_permission_grants
  after insert or update or delete on public.role_permission_grants
  for each row execute function public.audit_role_permission_grants();

-- ============================================================
-- 6. Trigger : profile_roles
-- ============================================================

create or replace function public.audit_profile_roles()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_event_type text;
  v_payload jsonb;
  v_role_code text;
  v_actor_profile_id uuid;
  v_target_profile_id uuid;
begin
  begin
    if tg_op = 'INSERT' then
      select code into v_role_code from public.roles where id = NEW.role_id;
      v_event_type := 'user.role.assigned';
      v_payload := jsonb_build_object(
        'profile_id', NEW.profile_id,
        'role_id', NEW.role_id,
        'role_code', v_role_code
      );
      v_actor_profile_id := public.current_profile_id();
      v_target_profile_id := NEW.profile_id;
    elsif tg_op = 'DELETE' then
      select code into v_role_code from public.roles where id = OLD.role_id;
      v_event_type := 'user.role.removed';
      v_payload := jsonb_build_object(
        'profile_id', OLD.profile_id,
        'role_id', OLD.role_id,
        'role_code', v_role_code
      );
      v_actor_profile_id := public.current_profile_id();
      v_target_profile_id := OLD.profile_id;
    else
      -- UPDATE : la clé primaire composite ne change pas, mais on trace quand même.
      select code into v_role_code from public.roles where id = NEW.role_id;
      v_event_type := 'user.role.assigned';
      v_payload := jsonb_build_object(
        'profile_id', NEW.profile_id,
        'role_id', NEW.role_id,
        'role_code', v_role_code,
        'previous_role_id', OLD.role_id
      );
      v_actor_profile_id := public.current_profile_id();
      v_target_profile_id := NEW.profile_id;
    end if;

    perform public.audit_event_from_trigger(
      v_event_type,
      v_actor_profile_id,
      v_target_profile_id,
      v_payload,
      null,
      true
    );
  exception when others then
    raise warning '[audit_profile_roles] failed: %', sqlerrm;
  end;

  return null;
end;
$$;

revoke all on function public.audit_profile_roles() from public;
grant execute on function public.audit_profile_roles() to authenticated;

drop trigger if exists audit_profile_roles on public.profile_roles;
create trigger audit_profile_roles
  after insert or update or delete on public.profile_roles
  for each row execute function public.audit_profile_roles();

-- ============================================================
-- 7. Trigger : scope_assignments
-- ============================================================

create or replace function public.audit_scope_assignments()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_event_type text;
  v_payload jsonb;
  v_actor_profile_id uuid;
  v_target_profile_id uuid;
begin
  begin
    if tg_op = 'INSERT' then
      v_event_type := 'scope.assigned';
      v_payload := jsonb_build_object(
        'profile_id', NEW.profile_id,
        'scope_type', NEW.scope_type,
        'scope_id', NEW.scope_id,
        'label', NEW.label
      );
      v_actor_profile_id := public.current_profile_id();
      v_target_profile_id := NEW.profile_id;
    elsif tg_op = 'UPDATE' then
      v_event_type := 'scope.updated';
      v_payload := jsonb_build_object(
        'profile_id', NEW.profile_id,
        'scope_type', NEW.scope_type,
        'scope_id', NEW.scope_id,
        'previous_scope_id', OLD.scope_id,
        'label', NEW.label,
        'previous_label', OLD.label
      );
      v_actor_profile_id := public.current_profile_id();
      v_target_profile_id := NEW.profile_id;
    else
      v_event_type := 'scope.removed';
      v_payload := jsonb_build_object(
        'profile_id', OLD.profile_id,
        'scope_type', OLD.scope_type,
        'scope_id', OLD.scope_id,
        'label', OLD.label
      );
      v_actor_profile_id := public.current_profile_id();
      v_target_profile_id := OLD.profile_id;
    end if;

    perform public.audit_event_from_trigger(
      v_event_type,
      v_actor_profile_id,
      v_target_profile_id,
      v_payload,
      null,
      true
    );
  exception when others then
    raise warning '[audit_scope_assignments] failed: %', sqlerrm;
  end;

  return null;
end;
$$;

revoke all on function public.audit_scope_assignments() from public;
grant execute on function public.audit_scope_assignments() to authenticated;

drop trigger if exists audit_scope_assignments on public.scope_assignments;
create trigger audit_scope_assignments
  after insert or update or delete on public.scope_assignments
  for each row execute function public.audit_scope_assignments();

-- ============================================================
-- 8. Trigger : fee_payments
-- ============================================================

create or replace function public.audit_fee_payments()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_event_type text;
  v_payload jsonb;
  v_actor_profile_id uuid;
begin
  begin
    if tg_op = 'INSERT' then
      v_event_type := 'finance.payment.recorded';
      v_payload := jsonb_build_object(
        'payment_id', NEW.id,
        'student_fee_id', NEW.student_fee_id,
        'amount', NEW.amount,
        'currency', NEW.currency,
        'mode', NEW.mode,
        'reference', NEW.reference,
        'status', NEW.status,
        'received_by', NEW.received_by
      );
      v_actor_profile_id := NEW.received_by;
    elsif tg_op = 'UPDATE' then
      if NEW.status = 'cancelled' and OLD.status <> 'cancelled' then
        v_event_type := 'finance.payment.cancelled';
      else
        v_event_type := 'finance.payment.updated';
      end if;
      v_payload := jsonb_build_object(
        'payment_id', NEW.id,
        'student_fee_id', NEW.student_fee_id,
        'amount', NEW.amount,
        'currency', NEW.currency,
        'status', NEW.status,
        'previous_status', OLD.status,
        'cancellation_reason', NEW.cancellation_reason,
        'received_by', NEW.received_by
      );
      v_actor_profile_id := public.current_profile_id();
    else
      v_event_type := 'finance.payment.updated';
      v_payload := jsonb_build_object(
        'payment_id', OLD.id,
        'student_fee_id', OLD.student_fee_id,
        'amount', OLD.amount,
        'currency', OLD.currency,
        'status', OLD.status,
        'received_by', OLD.received_by
      );
      v_actor_profile_id := public.current_profile_id();
    end if;

    perform public.audit_event_from_trigger(
      v_event_type,
      v_actor_profile_id,
      null,
      v_payload,
      null,
      true
    );
  exception when others then
    raise warning '[audit_fee_payments] failed: %', sqlerrm;
  end;

  return null;
end;
$$;

revoke all on function public.audit_fee_payments() from public;
grant execute on function public.audit_fee_payments() to authenticated;

drop trigger if exists audit_fee_payments on public.fee_payments;
create trigger audit_fee_payments
  after insert or update or delete on public.fee_payments
  for each row execute function public.audit_fee_payments();

-- ============================================================
-- 9. Trigger : cash_register_closures (adapté de cash_registers)
-- ============================================================

create or replace function public.audit_cash_register_closures()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_event_type text;
  v_payload jsonb;
  v_actor_profile_id uuid;
begin
  begin
    if tg_op = 'INSERT' then
      if NEW.status = 'closed' then
        v_event_type := 'finance.cash_register.closed';
      elsif NEW.status = 'reopened' then
        v_event_type := 'finance.cash_register.reopened';
      elsif NEW.status = 'adjusted' then
        v_event_type := 'finance.cash_register.adjusted';
      else
        return null;
      end if;
      v_payload := jsonb_build_object(
        'closure_id', NEW.id,
        'closure_date', NEW.closure_date,
        'total_amount', NEW.total_amount,
        'expected_amount', NEW.expected_amount,
        'difference', NEW.difference,
        'status', NEW.status,
        'closed_by', NEW.closed_by
      );
      v_actor_profile_id := NEW.closed_by;
    elsif tg_op = 'UPDATE' then
      if NEW.status = 'closed' and OLD.status <> 'closed' then
        v_event_type := 'finance.cash_register.closed';
      elsif NEW.status = 'reopened' and OLD.status <> 'reopened' then
        v_event_type := 'finance.cash_register.reopened';
      elsif NEW.status = 'adjusted' and OLD.status <> 'adjusted' then
        v_event_type := 'finance.cash_register.adjusted';
      else
        -- On ne trace que les transitions de statut.
        return null;
      end if;
      v_payload := jsonb_build_object(
        'closure_id', NEW.id,
        'closure_date', NEW.closure_date,
        'total_amount', NEW.total_amount,
        'expected_amount', NEW.expected_amount,
        'difference', NEW.difference,
        'status', NEW.status,
        'previous_status', OLD.status,
        'closed_by', NEW.closed_by
      );
      v_actor_profile_id := NEW.closed_by;
    else
      -- DELETE non attendu pour des clôtures.
      return null;
    end if;

    perform public.audit_event_from_trigger(
      v_event_type,
      v_actor_profile_id,
      null,
      v_payload,
      null,
      true
    );
  exception when others then
    raise warning '[audit_cash_register_closures] failed: %', sqlerrm;
  end;

  return null;
end;
$$;

revoke all on function public.audit_cash_register_closures() from public;
grant execute on function public.audit_cash_register_closures() to authenticated;

drop trigger if exists audit_cash_register_closures on public.cash_register_closures;
create trigger audit_cash_register_closures
  after insert or update on public.cash_register_closures
  for each row execute function public.audit_cash_register_closures();

-- ============================================================
-- 10. Trigger : security_events
-- ============================================================

create or replace function public.audit_security_events()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_event_type text;
  v_payload jsonb;
  v_success boolean;
  v_actor_profile_id uuid;
begin
  begin
    if NEW.decision = 'allowed' or NEW.decision = 'manual_override' then
      v_event_type := 'security.scan.success';
      v_success := true;
    else
      v_event_type := 'security.scan.failure';
      v_success := false;
    end if;

    v_payload := jsonb_build_object(
      'event_id', NEW.id,
      'student_id', NEW.student_id,
      'card_id', NEW.card_id,
      'location_id', NEW.location_id,
      'event_type', NEW.event_type,
      'decision', NEW.decision,
      'denial_reason', NEW.denial_reason,
      'scanned_by', NEW.scanned_by
    );
    v_actor_profile_id := NEW.scanned_by;

    perform public.audit_event_from_trigger(
      v_event_type,
      v_actor_profile_id,
      null,
      v_payload,
      null,
      v_success
    );
  exception when others then
    raise warning '[audit_security_events] failed: %', sqlerrm;
  end;

  return null;
end;
$$;

revoke all on function public.audit_security_events() from public;
grant execute on function public.audit_security_events() to authenticated;

drop trigger if exists audit_security_events on public.security_events;
create trigger audit_security_events
  after insert or update on public.security_events
  for each row execute function public.audit_security_events();

-- ============================================================
-- 11. Trigger : approval_requests
-- ============================================================

create or replace function public.audit_approval_requests()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_event_type text;
  v_payload jsonb;
  v_actor_profile_id uuid;
begin
  begin
    if tg_op = 'INSERT' then
      v_event_type := 'pilotage.approval.created';
      v_actor_profile_id := NEW.requested_by;
      v_payload := jsonb_build_object(
        'approval_id', NEW.id,
        'request_type', NEW.request_type,
        'entity_type', NEW.entity_type,
        'entity_id', NEW.entity_id,
        'requested_by', NEW.requested_by,
        'status', NEW.status,
        'reason', NEW.reason
      );
    elsif tg_op = 'UPDATE' then
      if NEW.status = 'approved' and OLD.status <> 'approved' then
        v_event_type := 'pilotage.approval.approved';
      elsif NEW.status = 'rejected' and OLD.status <> 'rejected' then
        v_event_type := 'pilotage.approval.rejected';
      else
        return null;
      end if;
      v_actor_profile_id := NEW.decided_by;
      v_payload := jsonb_build_object(
        'approval_id', NEW.id,
        'request_type', NEW.request_type,
        'entity_type', NEW.entity_type,
        'entity_id', NEW.entity_id,
        'requested_by', NEW.requested_by,
        'decided_by', NEW.decided_by,
        'previous_status', OLD.status,
        'status', NEW.status,
        'reason', NEW.reason
      );
    else
      return null;
    end if;

    perform public.audit_event_from_trigger(
      v_event_type,
      v_actor_profile_id,
      null,
      v_payload,
      null,
      true
    );
  exception when others then
    raise warning '[audit_approval_requests] failed: %', sqlerrm;
  end;

  return null;
end;
$$;

revoke all on function public.audit_approval_requests() from public;
grant execute on function public.audit_approval_requests() to authenticated;

drop trigger if exists audit_approval_requests on public.approval_requests;
create trigger audit_approval_requests
  after insert or update on public.approval_requests
  for each row execute function public.audit_approval_requests();

-- ============================================================
-- 12. Trigger : grades (adapté de pedagogy_grades)
-- ============================================================

create or replace function public.audit_grades()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_event_type text;
  v_payload jsonb;
  v_actor_profile_id uuid;
  v_target_profile_id uuid;
begin
  begin
    if tg_op = 'INSERT' then
      if NEW.status = 'published' then
        v_event_type := 'pedagogy.grade.published';
      else
        v_event_type := 'pedagogy.grade.updated';
      end if;
      v_actor_profile_id := NEW.created_by;
      v_target_profile_id := NEW.student_id;
      v_payload := jsonb_build_object(
        'grade_id', NEW.id,
        'assignment_id', NEW.assignment_id,
        'student_id', NEW.student_id,
        'value_numeric', NEW.value_numeric,
        'value_text', NEW.value_text,
        'status', NEW.status,
        'change_reason', NEW.change_reason,
        'created_by', NEW.created_by
      );
    elsif tg_op = 'UPDATE' then
      if NEW.status = 'published' and OLD.status <> 'published' then
        v_event_type := 'pedagogy.grade.published';
      else
        v_event_type := 'pedagogy.grade.updated';
      end if;
      v_actor_profile_id := NEW.updated_by;
      v_target_profile_id := NEW.student_id;
      v_payload := jsonb_build_object(
        'grade_id', NEW.id,
        'assignment_id', NEW.assignment_id,
        'student_id', NEW.student_id,
        'value_numeric', NEW.value_numeric,
        'value_text', NEW.value_text,
        'status', NEW.status,
        'previous_status', OLD.status,
        'change_reason', NEW.change_reason,
        'updated_by', NEW.updated_by
      );
    else
      v_event_type := 'pedagogy.grade.updated';
      v_actor_profile_id := public.current_profile_id();
      v_target_profile_id := OLD.student_id;
      v_payload := jsonb_build_object(
        'grade_id', OLD.id,
        'assignment_id', OLD.assignment_id,
        'student_id', OLD.student_id,
        'status', OLD.status
      );
    end if;

    perform public.audit_event_from_trigger(
      v_event_type,
      v_actor_profile_id,
      v_target_profile_id,
      v_payload,
      null,
      true
    );
  exception when others then
    raise warning '[audit_grades] failed: %', sqlerrm;
  end;

  return null;
end;
$$;

revoke all on function public.audit_grades() from public;
grant execute on function public.audit_grades() to authenticated;

drop trigger if exists audit_grades on public.grades;
create trigger audit_grades
  after insert or update or delete on public.grades
  for each row execute function public.audit_grades();

-- ============================================================
-- 13. Trigger : card_print_requests (adapté de cards_requests)
-- ============================================================

create or replace function public.audit_card_print_requests()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_event_type text;
  v_payload jsonb;
  v_actor_profile_id uuid;
begin
  begin
    if tg_op = 'INSERT' and NEW.status = 'printed' then
      v_event_type := 'cards.request.printed';
    elsif tg_op = 'UPDATE' and NEW.status = 'printed' and OLD.status <> 'printed' then
      v_event_type := 'cards.request.printed';
    else
      return null;
    end if;

    v_payload := jsonb_build_object(
      'request_id', NEW.id,
      'student_id', NEW.student_id,
      'format', NEW.format,
      'is_duplicate', NEW.is_duplicate,
      'status', NEW.status,
      'previous_status', case when tg_op = 'UPDATE' then OLD.status else null end,
      'printed_at', NEW.printed_at,
      'requested_by', NEW.requested_by
    );
    v_actor_profile_id := NEW.requested_by;

    perform public.audit_event_from_trigger(
      v_event_type,
      v_actor_profile_id,
      null,
      v_payload,
      null,
      true
    );
  exception when others then
    raise warning '[audit_card_print_requests] failed: %', sqlerrm;
  end;

  return null;
end;
$$;

revoke all on function public.audit_card_print_requests() from public;
grant execute on function public.audit_card_print_requests() to authenticated;

drop trigger if exists audit_card_print_requests on public.card_print_requests;
create trigger audit_card_print_requests
  after insert or update on public.card_print_requests
  for each row execute function public.audit_card_print_requests();
