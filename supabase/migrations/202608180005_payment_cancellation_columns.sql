-- SchoolSafe V2 — C1 : colonnes d'annulation sur les paiements

alter table public.fee_payments
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id) on delete set null;

comment on column public.fee_payments.cancelled_at is 'Date d annulation du paiement';
comment on column public.fee_payments.cancelled_by is 'Profil ayant annule le paiement';
