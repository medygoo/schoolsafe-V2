-- SchoolSafe V2 — Module Palmarès
-- Classements mensuels par classe et par école, basés sur les cotes publiées.

-- ============================================================
-- 1. Palmarès mensuel
-- ============================================================
create table if not exists public.rankings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  status text not null default 'draft' check (status in ('draft', 'published')),
  computed_at timestamptz not null default now(),
  published_at timestamptz,
  computed_by_profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, class_id, month)
);

comment on column public.rankings.class_id is 'NULL = palmarès général de toute l’école';
comment on column public.rankings.month is 'Format YYYY-MM';

-- ============================================================
-- 2. Entrées de classement
-- ============================================================
create table if not exists public.ranking_entries (
  id uuid primary key default gen_random_uuid(),
  ranking_id uuid not null references public.rankings(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  rank integer not null check (rank > 0),
  monthly_average numeric not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (ranking_id, student_id)
);

comment on column public.ranking_entries.metadata is 'Détails des cotes agrégées : [{assignment_id, value, coefficient}]';

-- ============================================================
-- 3. Étoiles d’encouragement (un parent ne peut en donner qu’une par élève/mois)
-- ============================================================
create table if not exists public.ranking_stars (
  id uuid primary key default gen_random_uuid(),
  ranking_id uuid not null references public.rankings(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  parent_profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (ranking_id, student_id, parent_profile_id)
);

-- ============================================================
-- 4. Indexes
-- ============================================================
create index if not exists rankings_school_id_idx on public.rankings(school_id);
create index if not exists rankings_class_id_idx on public.rankings(class_id);
create index if not exists rankings_month_idx on public.rankings(month);
create index if not exists ranking_entries_ranking_id_idx on public.ranking_entries(ranking_id);
create index if not exists ranking_entries_student_id_idx on public.ranking_entries(student_id);
create index if not exists ranking_stars_ranking_id_idx on public.ranking_stars(ranking_id);
create index if not exists ranking_stars_student_id_idx on public.ranking_stars(student_id);
create index if not exists ranking_stars_parent_profile_id_idx on public.ranking_stars(parent_profile_id);

-- ============================================================
-- 5. RLS
-- ============================================================
alter table public.rankings enable row level security;
alter table public.ranking_entries enable row level security;
alter table public.ranking_stars enable row level security;

revoke all on table public.rankings from anon, authenticated;
revoke all on table public.ranking_entries from anon, authenticated;
revoke all on table public.ranking_stars from anon, authenticated;

grant select, insert, update, delete on public.rankings to authenticated;
grant select, insert, update, delete on public.ranking_entries to authenticated;
grant select, insert, delete on public.ranking_stars to authenticated;

-- ============================================================
-- 6. RLS : chaîne complète USER → SCHOOL → ROLE → PERMISSION → SCOPE → CONDITION → EXCEPTION
-- ============================================================

-- Nettoyage des politiques permissives par défaut
drop policy if exists rankings_current_school on public.rankings;
drop policy if exists ranking_entries_current_school on public.ranking_entries;
drop policy if exists ranking_stars_current_school on public.ranking_stars;

-- ------------------------------------------------------------
-- rankings
-- ------------------------------------------------------------
create policy rankings_select_chain
on public.rankings
for select
to authenticated
using (
  school_id = public.current_school_id()
  and (
    public.has_permission('school.manage')
    or (
      public.has_permission('palmarques.read')
      and (
        class_id is null
        or public.has_scope('assigned_classes', class_id)
        or exists (
          select 1
          from public.students s
          where s.class_id = rankings.class_id
            and public.has_scope('own_children', s.id)
        )
      )
    )
  )
);

create policy rankings_insert_chain
on public.rankings
for insert
to authenticated
with check (
  school_id = public.current_school_id()
  and (
    public.has_permission('school.manage')
    or (
      public.has_permission('palmarques.manage')
      and (class_id is null or public.has_scope('assigned_classes', class_id))
    )
  )
);

create policy rankings_update_chain
on public.rankings
for update
to authenticated
using (
  school_id = public.current_school_id()
  and (
    public.has_permission('school.manage')
    or (
      public.has_permission('palmarques.manage')
      and (class_id is null or public.has_scope('assigned_classes', class_id))
    )
  )
)
with check (
  school_id = public.current_school_id()
  and (
    public.has_permission('school.manage')
    or (
      public.has_permission('palmarques.manage')
      and (class_id is null or public.has_scope('assigned_classes', class_id))
    )
  )
);

create policy rankings_delete_chain
on public.rankings
for delete
to authenticated
using (
  school_id = public.current_school_id()
  and (
    public.has_permission('school.manage')
    or (
      public.has_permission('palmarques.manage')
      and (class_id is null or public.has_scope('assigned_classes', class_id))
    )
  )
);

-- ------------------------------------------------------------
-- ranking_entries
-- ------------------------------------------------------------
create policy ranking_entries_select_chain
on public.ranking_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.rankings r
    where r.id = ranking_entries.ranking_id
      and r.school_id = public.current_school_id()
      and (
        public.has_permission('school.manage')
        or (
          public.has_permission('palmarques.read')
          and (
            r.class_id is null
            or public.has_scope('assigned_classes', r.class_id)
            or exists (
              select 1
              from public.student_guardians sg
              join public.students s on s.id = sg.student_id
              where sg.profile_id = public.current_profile_id()
                and s.class_id = r.class_id
            )
          )
        )
      )
  )
);

create policy ranking_entries_insert_chain
on public.ranking_entries
for insert
to authenticated
with check (
  exists (
    select 1
    from public.rankings r
    where r.id = ranking_entries.ranking_id
      and r.school_id = public.current_school_id()
      and (
        public.has_permission('school.manage')
        or (
          public.has_permission('palmarques.manage')
          and (r.class_id is null or public.has_scope('assigned_classes', r.class_id))
        )
      )
  )
);

create policy ranking_entries_update_chain
on public.ranking_entries
for update
to authenticated
using (
  exists (
    select 1
    from public.rankings r
    where r.id = ranking_entries.ranking_id
      and r.school_id = public.current_school_id()
      and (
        public.has_permission('school.manage')
        or (
          public.has_permission('palmarques.manage')
          and (r.class_id is null or public.has_scope('assigned_classes', r.class_id))
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.rankings r
    where r.id = ranking_entries.ranking_id
      and r.school_id = public.current_school_id()
      and (
        public.has_permission('school.manage')
        or (
          public.has_permission('palmarques.manage')
          and (r.class_id is null or public.has_scope('assigned_classes', r.class_id))
        )
      )
  )
);

create policy ranking_entries_delete_chain
on public.ranking_entries
for delete
to authenticated
using (
  exists (
    select 1
    from public.rankings r
    where r.id = ranking_entries.ranking_id
      and r.school_id = public.current_school_id()
      and (
        public.has_permission('school.manage')
        or (
          public.has_permission('palmarques.manage')
          and (r.class_id is null or public.has_scope('assigned_classes', r.class_id))
        )
      )
  )
);

-- ------------------------------------------------------------
-- ranking_stars
-- ------------------------------------------------------------
create policy ranking_stars_select_chain
on public.ranking_stars
for select
to authenticated
using (
  parent_profile_id = public.current_profile_id()
  or exists (
    select 1
    from public.rankings r
    where r.id = ranking_stars.ranking_id
      and r.school_id = public.current_school_id()
      and (
        public.has_permission('school.manage')
        or public.has_permission('palmarques.read')
      )
  )
);

create policy ranking_stars_insert_chain
on public.ranking_stars
for insert
to authenticated
with check (
  parent_profile_id = public.current_profile_id()
  and public.has_permission('palmarques.read')
  and public.has_scope('own_children', ranking_stars.student_id)
  and exists (
    select 1
    from public.rankings r
    where r.id = ranking_stars.ranking_id
      and r.school_id = public.current_school_id()
      and r.status = 'published'
  )
  and exists (
    select 1
    from public.ranking_entries re
    where re.ranking_id = ranking_stars.ranking_id
      and re.student_id = ranking_stars.student_id
  )
);

create policy ranking_stars_delete_chain
on public.ranking_stars
for delete
to authenticated
using (
  parent_profile_id = public.current_profile_id()
  and public.has_permission('palmarques.read')
  and public.has_scope('own_children', ranking_stars.student_id)
  and exists (
    select 1
    from public.rankings r
    where r.id = ranking_stars.ranking_id
      and r.school_id = public.current_school_id()
  )
);
