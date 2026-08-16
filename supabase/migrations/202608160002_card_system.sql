-- SchoolSafe V2 — Sous-système de cartes élèves
-- Crée les tables minimales nécessaires à la production et au suivi des cartes.
-- Les tables students/classes/guardians seront enrichies par les modules métiers futurs.

-- ============================================================
-- 1. Classes (données minimales pour la carte)
-- ============================================================
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  cycle_key text not null check (cycle_key in ('nursery', 'primary', 'secondary')),
  name text not null,
  option text,
  teacher_id uuid references public.profiles(id) on delete set null,
  card_color text default '#e9a515',
  card_color_soft text default '#f9e8b8',
  card_color_dark text default '#b87e0d',
  card_pat text default 'auto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.classes.cycle_key is 'nursery = maternelle, primary = primaire, secondary = secondaire/humanités';
comment on column public.classes.card_pat is 'Patrimoine visuel choisi pour les cartes de cette classe';

-- ============================================================
-- 2. Élèves (données minimales pour la carte)
-- ============================================================
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  matricule text not null,
  first_name text not null,
  middle_name text,
  last_name text not null,
  date_of_birth date,
  gender text check (gender in ('M', 'F')),
  photo_path text,
  card_printed boolean not null default false,
  card_print_date date,
  card_print_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, matricule)
);

comment on column public.students.matricule is 'Numéro unique de l''élève dans l''école, encodé dans le QR code';
comment on column public.students.photo_path is 'Chemin de la photo sur R2 ou VPS';
comment on column public.students.card_printed is 'Une carte a déjà été imprimée au moins une fois';
comment on column public.students.card_print_count is 'Nombre total d''impressions (première + duplicatas)';

-- ============================================================
-- 3. Tuteurs / personnes autorisées
-- ============================================================
create table if not exists public.student_guardians (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  guardian_type text not null check (guardian_type in ('pere', 'mere', 'tuteur', 'autre')),
  is_primary boolean not null default false,
  full_name text not null,
  phone text,
  email text,
  address text,
  is_authorized_pickup boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.student_guardians.is_primary is 'Tuteur principal affiché sur la carte et identifié pour la récupération';
comment on column public.student_guardians.is_authorized_pickup is 'Personne autorisée à récupérer l''élève';

-- ============================================================
-- 4. Demandes d'impression de cartes
-- ============================================================
create table if not exists public.card_print_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  format text not null check (format in ('badge', 'carte')),
  is_duplicate boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'submitted', 'printed', 'failed')),
  front_image_url text,
  back_image_url text,
  front_r2_key text,
  back_r2_key text,
  metadata jsonb not null default '{}'::jsonb,
  control_app_reference text,
  error_message text,
  requested_at timestamptz not null default now(),
  submitted_at timestamptz,
  printed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.card_print_requests.format is 'badge = 340x540 px, carte = 560x353 px';
comment on column public.card_print_requests.status is 'pending → submitted → printed | failed';
comment on column public.card_print_requests.metadata is 'Matricule, nom, classe, format et autres métadonnées de la carte';

-- ============================================================
-- 5. Indexes
-- ============================================================
create index if not exists classes_school_id_idx on public.classes(school_id);
create index if not exists classes_academic_year_idx on public.classes(academic_year_id);
create index if not exists students_school_id_idx on public.students(school_id);
create index if not exists students_class_id_idx on public.students(class_id);
create index if not exists students_matricule_idx on public.students(school_id, matricule);
create index if not exists student_guardians_student_id_idx on public.student_guardians(student_id);
create index if not exists card_print_requests_school_id_idx on public.card_print_requests(school_id);
create index if not exists card_print_requests_student_id_idx on public.card_print_requests(student_id);
create index if not exists card_print_requests_status_idx on public.card_print_requests(school_id, status);

-- ============================================================
-- 6. RLS
-- ============================================================
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.student_guardians enable row level security;
alter table public.card_print_requests enable row level security;

revoke all on table public.classes from anon, authenticated;
revoke all on table public.students from anon, authenticated;
revoke all on table public.student_guardians from anon, authenticated;
revoke all on table public.card_print_requests from anon, authenticated;

grant select, insert, update on public.classes to authenticated;
grant select, insert, update on public.students to authenticated;
grant select, insert, update on public.student_guardians to authenticated;
grant select, insert, update on public.card_print_requests to authenticated;

create policy classes_current_school
on public.classes
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());

create policy students_current_school
on public.students
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());

create policy student_guardians_current_school
on public.student_guardians
for all
to authenticated
using (
  student_id in (
    select s.id from public.students s where s.school_id = public.current_school_id()
  )
)
with check (
  student_id in (
    select s.id from public.students s where s.school_id = public.current_school_id()
  )
);

create policy card_print_requests_current_school
on public.card_print_requests
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());
