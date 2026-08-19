-- SchoolSafe V2 — C1 review : enregistrement atomique d'un paiement avec recalcul du solde

create or replace function public.record_payment(
  p_school_id uuid,
  p_profile_id uuid,
  p_student_fee_id uuid,
  p_amount numeric,
  p_currency text,
  p_received_at timestamptz,
  p_receipt_no text,
  p_mode text,
  p_reference text,
  p_metadata jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_student_fee record;
  v_payment record;
  v_new_paid numeric(12, 2);
  v_new_remaining numeric(12, 2);
  v_new_status text;
begin
  -- Verrouille la ligne de frais étudiant pour garantir l'atomicité
  select id, amount_expected
  into v_student_fee
  from public.student_fees
  where id = p_student_fee_id and school_id = p_school_id
  for update;

  if not found then
    raise exception 'Frais étudiant introuvable';
  end if;

  insert into public.fee_payments (
    school_id,
    student_fee_id,
    amount,
    currency,
    received_by,
    received_at,
    receipt_no,
    mode,
    reference,
    metadata,
    status
  )
  values (
    p_school_id,
    p_student_fee_id,
    p_amount,
    p_currency,
    p_profile_id,
    p_received_at,
    p_receipt_no,
    p_mode,
    p_reference,
    coalesce(p_metadata, '{}'::jsonb),
    'valid'
  )
  returning * into v_payment;

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
      'school_id', v_payment.school_id,
      'student_fee_id', v_payment.student_fee_id,
      'amount', v_payment.amount,
      'currency', v_payment.currency,
      'received_by', v_payment.received_by,
      'received_at', v_payment.received_at,
      'receipt_no', v_payment.receipt_no,
      'mode', v_payment.mode,
      'reference', v_payment.reference,
      'metadata', v_payment.metadata,
      'status', v_payment.status,
      'created_at', v_payment.created_at
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

revoke all on function public.record_payment(uuid, uuid, uuid, numeric, text, timestamptz, text, text, text, jsonb) from public;
grant execute on function public.record_payment(uuid, uuid, uuid, numeric, text, timestamptz, text, text, text, jsonb) to authenticated;
grant execute on function public.record_payment(uuid, uuid, uuid, numeric, text, timestamptz, text, text, text, jsonb) to service_role;
