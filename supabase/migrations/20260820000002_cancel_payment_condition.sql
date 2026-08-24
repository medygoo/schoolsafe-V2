-- SchoolSafe V2 — C1 (suite) : condition de délai d'annulation dans cancel_payment
-- La vérification RLS UPDATE générique aurait bloqué tous les UPDATE sur fee_payments.
-- Elle est donc intégrée dans la RPC métier.

create or replace function public.cancel_payment(
  p_school_id uuid,
  p_profile_id uuid,
  p_payment_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment record;
  v_student_fee record;
  v_new_paid numeric(12, 2);
  v_new_remaining numeric(12, 2);
  v_new_status text;
begin
  -- Vérification de permission et de condition (délai d'annulation 24h)
  if not public.has_permission('finance.payment.cancel') then
    raise exception 'Permission refusée' using errcode = '42501';
  end if;

  if not public.has_condition('within_cancellation_window', jsonb_build_object('payment_id', p_payment_id)) then
    raise exception 'Annulation impossible : délai de 24 heures dépassé' using errcode = 'P0001';
  end if;

  select id, student_fee_id, amount, status
  into v_payment
  from public.fee_payments
  where id = p_payment_id and school_id = p_school_id
  for update;

  if not found then
    raise exception 'Paiement introuvable';
  end if;

  if v_payment.status = 'cancelled' then
    raise exception 'Le paiement est déjà annulé';
  end if;

  select id, amount_expected
  into v_student_fee
  from public.student_fees
  where id = v_payment.student_fee_id and school_id = p_school_id
  for update;

  if not found then
    raise exception 'Frais étudiant introuvable';
  end if;

  update public.fee_payments
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = p_profile_id,
      cancellation_reason = p_reason,
      updated_at = now()
  where id = p_payment_id;

  select coalesce(sum(amount), 0)::numeric(12, 2)
  into v_new_paid
  from public.fee_payments
  where student_fee_id = v_student_fee.id and status <> 'cancelled';

  v_new_remaining := greatest(v_student_fee.amount_expected - v_new_paid, 0);

  if v_new_remaining <= 0 then
    v_new_status := 'paid';
  elsif v_new_paid > 0 then
    v_new_status := 'partial';
  else
    v_new_status := 'pending';
  end if;

  update public.student_fees
  set amount_paid = v_new_paid,
      amount_remaining = v_new_remaining,
      status = v_new_status,
      updated_at = now()
  where id = v_student_fee.id;

  return jsonb_build_object(
    'payment', jsonb_build_object(
      'id', v_payment.id,
      'status', 'cancelled',
      'cancelled_at', now(),
      'cancelled_by', p_profile_id,
      'cancellation_reason', p_reason
    ),
    'student_fee', jsonb_build_object(
      'id', v_student_fee.id,
      'amount_expected', v_student_fee.amount_expected,
      'amount_paid', v_new_paid,
      'amount_remaining', v_new_remaining,
      'status', v_new_status
    )
  );
end;
$$;

revoke all on function public.cancel_payment(uuid, uuid, uuid, text) from public;
grant execute on function public.cancel_payment(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.cancel_payment(uuid, uuid, uuid, text) to service_role;
