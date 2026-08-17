-- Ajout de la version et de la clé de contrôle sur les demandes de carte.
-- La version est incrémentée à chaque envoi (1 = première carte, 2+ = duplicata).

alter table public.card_print_requests
  add column if not exists version integer not null default 1,
  add column if not exists is_duplicate boolean not null default false;

create index if not exists card_print_requests_student_version_idx
  on public.card_print_requests(student_id, version desc);

-- Fonction atomique pour incrémenter le compteur d'impression d'un élève
-- et retourner la nouvelle version.
create or replace function public.increment_card_print_count(student_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_count integer;
begin
  update public.students
  set card_print_count = card_print_count + 1,
      card_printed = true,
      card_print_date = current_date
  where id = student_id
  returning card_print_count into new_count;

  return new_count;
end;
$$;

revoke all on function public.increment_card_print_count(uuid) from public;
grant execute on function public.increment_card_print_count(uuid) to authenticated;
