-- Optional institutional fields for Document Engine
ALTER TABLE public.school
  ADD COLUMN IF NOT EXISTS motto text,
  ADD COLUMN IF NOT EXISTS currency text default 'USD',
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS director_name text,
  ADD COLUMN IF NOT EXISTS director_signature_url text,
  ADD COLUMN IF NOT EXISTS official_seal_url text,
  ADD COLUMN IF NOT EXISTS official_language text default 'FR';

-- Document numbering sequences
CREATE TABLE IF NOT EXISTS public.document_number_sequences (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  document_type text not null,
  prefix text not null default '',
  last_number bigint not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (school_id, document_type)
);

-- Function to atomically get the next number
CREATE OR REPLACE FUNCTION public.next_document_number(
  p_school_id uuid,
  p_document_type text,
  p_prefix text default ''
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text;
  v_next bigint;
BEGIN
  v_year := to_char(now(), 'YYYY');

  INSERT INTO public.document_number_sequences AS s (school_id, document_type, prefix, last_number)
  VALUES (p_school_id, p_document_type, p_prefix, 1)
  ON CONFLICT (school_id, document_type)
  DO UPDATE SET last_number = s.last_number + 1, updated_at = now()
  RETURNING last_number INTO v_next;

  RETURN p_prefix || v_year || '-' || lpad(v_next::text, 5, '0');
END;
$$;
