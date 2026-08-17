-- SchoolSafe V2 — Module Pédagogie, Phase 1
-- Fondation : matières, affectations enseignants, devoirs, cotations, cahier de préparation.
-- Pas de calcul de moyenne dans cette phase ; on stocke les données brutes.

-- ============================================================
-- 1. Matières (par langue, par cycle)
-- ============================================================
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  cycle_key text not null check (cycle_key in ('nursery', 'primary', 'secondary')),
  code text not null,
  name text not null,
  language text not null check (language in ('FR', 'EN')),
  subject_family_code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, code, language)
);

comment on column public.subjects.code is 'Code métier de la matière, ex. MATH, FRAN, ENGL';
comment on column public.subjects.language is 'Langue du parcours pédagogique : FR ou EN';
comment on column public.subjects.subject_family_code is 'Permet de regrouper les variantes FR/EN d''une même matière sans les forcer à fusionner';

-- ============================================================
-- 2. Affectations enseignant ↔ classe ↔ matière
--    subject_id NULL + is_tutor = vrai → titulaire de la classe
-- ============================================================
create table if not exists public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  is_tutor boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_assignment_target check (
    (subject_id is not null) or (is_tutor = true)
  )
);

comment on column public.teacher_assignments.is_tutor is 'Titulaire de la classe ; subject_id doit être NULL dans ce cas';

-- ============================================================
-- 3. Devoirs / évaluations
-- ============================================================
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  type text not null check (type in ('homework', 'quiz', 'exam', 'compensatory')),
  scale_mode text not null default 'numeric' check (scale_mode in ('numeric', 'qualitative', 'custom')),
  scale_max numeric,
  scale_label text,
  coefficient numeric not null default 1,
  due_date date,
  prerequisites text,
  instructions text,
  language text not null check (language in ('FR', 'EN')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.assignments.scale_mode is 'numeric = valeur chiffrée, qualitative = appréciation, custom = libre';
comment on column public.assignments.scale_label is 'Libellé libre de l''échelle : /20, /10, %, Acquis/En acquisition…';
comment on column public.assignments.coefficient is 'Coefficient pédagogique du devoir, configurable par l''enseignant';

-- ============================================================
-- 4. Questions d'un devoir
-- ============================================================
create table if not exists public.assignment_questions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  text text not null,
  type text not null,
  points numeric,
  answer_space text,
  choices text,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 5. Cotations
-- ============================================================
create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  value_numeric numeric,
  value_text text,
  normalized_value numeric,
  comment text,
  change_reason text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

comment on column public.grades.normalized_value is 'Valeur normalisée (ex. pourcentage) pour futur calcul de moyenne';
comment on column public.grades.change_reason is 'Motif de modification d''une cote déjà publiée';

-- ============================================================
-- 6. Cahier de préparation
-- ============================================================
create table if not exists public.lesson_plans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete set null,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  lesson_date date not null,
  objectives text,
  materials text,
  procedure text,
  homework_assignment_id uuid references public.assignments(id) on delete set null,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.lesson_plans.attachments is 'Liste de pièces jointes : {name, url, type}';

-- ============================================================
-- 7. Indexes
-- ============================================================
create index if not exists subjects_school_id_idx on public.subjects(school_id);
create index if not exists subjects_cycle_idx on public.subjects(school_id, cycle_key);
create index if not exists teacher_assignments_school_id_idx on public.teacher_assignments(school_id);
create index if not exists teacher_assignments_class_id_idx on public.teacher_assignments(class_id);
create index if not exists teacher_assignments_teacher_id_idx on public.teacher_assignments(teacher_id);
create index if not exists assignments_school_id_idx on public.assignments(school_id);
create index if not exists assignments_class_id_idx on public.assignments(class_id);
create index if not exists assignments_subject_id_idx on public.assignments(subject_id);
create index if not exists assignments_teacher_id_idx on public.assignments(teacher_id);
create index if not exists assignment_questions_assignment_id_idx on public.assignment_questions(assignment_id);
create index if not exists grades_assignment_id_idx on public.grades(assignment_id);
create index if not exists grades_student_id_idx on public.grades(student_id);
create index if not exists lesson_plans_school_id_idx on public.lesson_plans(school_id);
create index if not exists lesson_plans_class_id_idx on public.lesson_plans(class_id);
create index if not exists lesson_plans_teacher_id_idx on public.lesson_plans(teacher_id);

-- ============================================================
-- 8. RLS
-- ============================================================
alter table public.subjects enable row level security;
alter table public.teacher_assignments enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_questions enable row level security;
alter table public.grades enable row level security;
alter table public.lesson_plans enable row level security;

revoke all on table public.subjects from anon, authenticated;
revoke all on table public.teacher_assignments from anon, authenticated;
revoke all on table public.assignments from anon, authenticated;
revoke all on table public.assignment_questions from anon, authenticated;
revoke all on table public.grades from anon, authenticated;
revoke all on table public.lesson_plans from anon, authenticated;

grant select, insert, update on public.subjects to authenticated;
grant select, insert, update, delete on public.teacher_assignments to authenticated;
grant select, insert, update on public.assignments to authenticated;
grant select, insert, update, delete on public.assignment_questions to authenticated;
grant select, insert, update on public.grades to authenticated;
grant select, insert, update on public.lesson_plans to authenticated;

create policy subjects_current_school
on public.subjects
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());

create policy teacher_assignments_current_school
on public.teacher_assignments
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());

create policy assignments_current_school
on public.assignments
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());

create policy assignment_questions_current_school
on public.assignment_questions
for all
to authenticated
using (
  assignment_id in (
    select a.id from public.assignments a where a.school_id = public.current_school_id()
  )
)
with check (
  assignment_id in (
    select a.id from public.assignments a where a.school_id = public.current_school_id()
  )
);

create policy grades_current_school
on public.grades
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());

create policy lesson_plans_current_school
on public.lesson_plans
for all
to authenticated
using (school_id = public.current_school_id())
with check (school_id = public.current_school_id());
