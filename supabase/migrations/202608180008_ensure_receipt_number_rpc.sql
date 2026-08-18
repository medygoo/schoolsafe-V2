-- SchoolSafe V2 — C2 review : assignation atomique du numéro de reçu

create or replace function public.ensure_receipt_number(
  p_payment_id uuid,
  p_school_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt_no text;
begin
  -- Verrouille la ligne paiement pour éviter les numéros doubles en concurrence
  select receipt_no into v_receipt_no
  from public.fee_payments
  where id = p_payment_id
    and school_id = p_school_id
  for update;

  if not found then
    raise exception 'Paiement introuvable';
  end if;

  if v_receipt_no is not null then
    return v_receipt_no;
  end if;

  v_receipt_no := public.next_document_number(p_school_id, 'receipt', 'REC-');

  update public.fee_payments
  set receipt_no = v_receipt_no
  where id = p_payment_id
    and school_id = p_school_id;

  return v_receipt_no;
end;
$$;
