-- SchoolSafe V2 — B1 : création et consultation sécurisées d'un dossier élève en préparation
-- Chaîne verrouillée : Utilisateur → Rôle → Permission → Portée → Exception.
-- B1 ne contient aucune transition d'activation.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ============================================================
-- 1. Cycle de vie élève et état d'activation Parent
-- ============================================================
alter table public.students
  add column if not exists lifecycle_status text not null default 'active',
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table public.students
  drop constraint if exists students_lifecycle_status_check;
alter table public.students
  add constraint students_lifecycle_status_check
  check (lifecycle_status in ('draft', 'active'));

-- Les lignes existantes restent actives ; toute future insertion omettant le statut devient un draft.
update public.students set lifecycle_status = 'active' where lifecycle_status is null;
alter table public.students alter column lifecycle_status set default 'draft';

alter table public.students
  drop constraint if exists students_draft_class_projection_check;
alter table public.students
  add constraint students_draft_class_projection_check
  check (lifecycle_status <> 'draft' or class_id is null);

alter table public.profiles alter column auth_user_id drop not null;
alter table public.profiles
  add column if not exists email text,
  add column if not exists account_status text not null default 'active';

alter table public.profiles
  drop constraint if exists profiles_account_status_check;
alter table public.profiles
  add constraint profiles_account_status_check
  check (account_status in ('active', 'pending_activation'));

create unique index if not exists profiles_school_email_unique_idx
  on public.profiles (school_id, lower(email))
  where email is not null;

alter table public.student_guardians
  add column if not exists school_id uuid references public.school(id) on delete cascade,
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

update public.student_guardians sg
set school_id = s.school_id
from public.students s
where s.id = sg.student_id
  and sg.school_id is null;

alter table public.student_guardians alter column school_id set not null;
create index if not exists student_guardians_school_id_idx
  on public.student_guardians (school_id);

-- ============================================================
-- 2. Inscriptions : source de vérité et historique
-- ============================================================
create table public.student_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  school_id uuid not null references public.school(id) on delete cascade,
  academic_year_id uuid references public.academic_years(id) on delete restrict,
  class_id uuid references public.classes(id) on delete restrict,
  status text not null check (status in ('draft', 'active')),
  starts_on date not null,
  ends_on date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

create unique index student_enrollments_one_status_idx
  on public.student_enrollments (student_id, status);
create unique index student_enrollments_one_active_idx
  on public.student_enrollments (student_id)
  where status = 'active';
create index student_enrollments_school_status_idx
  on public.student_enrollments (school_id, status);
create index student_enrollments_class_idx
  on public.student_enrollments (class_id);

create table public.student_enrollment_events (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.student_enrollments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index student_enrollment_events_enrollment_idx
  on public.student_enrollment_events (enrollment_id, created_at desc);
create index student_enrollment_events_student_idx
  on public.student_enrollment_events (student_id, created_at desc);

create table public.parent_invitations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  email text not null,
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending_activation' check (status = 'pending_activation'),
  expires_at timestamptz not null,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index parent_invitations_token_hash_idx
  on public.parent_invitations (token_hash);
create index parent_invitations_school_status_idx
  on public.parent_invitations (school_id, status);
create index parent_invitations_student_id_idx
  on public.parent_invitations (student_id);
create index students_school_lifecycle_name_idx
  on public.students (school_id, lifecycle_status, last_name, first_name);

-- ============================================================
-- 3. Résolution interne des permissions et des portées
-- ============================================================
create or replace function private.profile_has_permission(
  p_profile_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not exists (
      select 1
      from public.profile_roles pr
      join public.role_permission_grants rpg on rpg.role_id = pr.role_id and rpg.allowed = false
      join public.permissions p on p.id = rpg.permission_id
      where pr.profile_id = p_profile_id and p.code = p_permission_code
    )
    and not exists (
      select 1
      from public.profile_permission_exceptions ppe
      where ppe.profile_id = p_profile_id
        and ppe.permission_code = p_permission_code
        and ppe.allowed = false
        and (ppe.expires_at is null or ppe.expires_at > now())
    )
    and (
      exists (
        select 1
        from public.profile_permission_exceptions ppe
        where ppe.profile_id = p_profile_id
          and ppe.permission_code = p_permission_code
          and ppe.allowed = true
          and (ppe.expires_at is null or ppe.expires_at > now())
      )
      or exists (
        select 1
        from public.profile_roles pr
        join public.role_permission_grants rpg on rpg.role_id = pr.role_id and rpg.allowed = true
        join public.permissions p on p.id = rpg.permission_id
        where pr.profile_id = p_profile_id and p.code = p_permission_code
      )
    )
$$;

create or replace function private.profile_has_role(p_profile_id uuid, p_role_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profile_roles pr
    join public.roles r on r.id = pr.role_id
    where pr.profile_id = p_profile_id and r.code = p_role_code
  )
$$;

create or replace function private.current_profile_is_guardian(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.student_guardians sg
    where sg.student_id = p_student_id
      and sg.profile_id = public.current_profile_id()
  )
$$;

create or replace function private.current_profile_teaches_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.teacher_assignments ta
    where ta.class_id = p_class_id
      and ta.teacher_id = public.current_profile_id()
  )
$$;

revoke all on function private.profile_has_permission(uuid, text) from public, anon, authenticated;
revoke all on function private.profile_has_role(uuid, text) from public, anon, authenticated;
revoke all on function private.current_profile_is_guardian(uuid) from public, anon;
revoke all on function private.current_profile_teaches_class(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.profile_has_role(uuid, text) to authenticated;
grant execute on function private.current_profile_is_guardian(uuid) to authenticated;
grant execute on function private.current_profile_teaches_class(uuid) to authenticated;

-- ============================================================
-- 4. Contraintes de projection et historique hérité
-- ============================================================
create or replace function private.guard_student_lifecycle_and_projection()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.lifecycle_status = 'draft' and new.class_id is not null then
    raise check_violation using message = 'A draft student cannot have a class projection';
  end if;

  if tg_op = 'UPDATE' then
    if old.lifecycle_status is distinct from new.lifecycle_status then
      raise check_violation using message = 'Student lifecycle transitions are not available in B1';
    end if;
    if old.class_id is distinct from new.class_id and pg_trigger_depth() < 2 then
      raise check_violation using message = 'students.class_id is a controlled active-enrollment projection';
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists guard_student_lifecycle_and_projection on public.students;
create trigger guard_student_lifecycle_and_projection
before insert or update on public.students
for each row execute function private.guard_student_lifecycle_and_projection();

create or replace function private.validate_student_enrollment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_student public.students%rowtype;
  v_class public.classes%rowtype;
begin
  select * into v_student from public.students where id = new.student_id;
  if not found or v_student.school_id <> new.school_id then
    raise check_violation using message = 'Enrollment student and school must match';
  end if;

  if new.class_id is not null then
    select * into v_class from public.classes where id = new.class_id;
    if not found or v_class.school_id <> new.school_id then
      raise check_violation using message = 'Enrollment class must belong to the same school';
    end if;
    if v_class.academic_year_id is distinct from new.academic_year_id then
      raise check_violation using message = 'Enrollment class and academic year must match';
    end if;
  end if;

  if new.status = 'draft' and v_student.lifecycle_status <> 'draft' then
    raise check_violation using message = 'Draft enrollment requires a draft student';
  end if;
  if new.status = 'active' and v_student.lifecycle_status <> 'active' then
    raise check_violation using message = 'Active enrollment requires an active student';
  end if;

  if tg_op = 'UPDATE' and (
    old.student_id is distinct from new.student_id
    or old.school_id is distinct from new.school_id
    or old.academic_year_id is distinct from new.academic_year_id
    or old.class_id is distinct from new.class_id
    or old.status is distinct from new.status
  ) then
    raise check_violation using message = 'Enrollment transitions and class changes are not available in B1';
  end if;

  new.updated_at := now();
  return new;
end
$$;

create or replace function private.project_active_enrollment_class()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'active' then
    update public.students set class_id = new.class_id where id = new.student_id;
  end if;
  return new;
end
$$;

drop trigger if exists validate_student_enrollment on public.student_enrollments;
create trigger validate_student_enrollment
before insert or update on public.student_enrollments
for each row execute function private.validate_student_enrollment();

drop trigger if exists project_active_enrollment_class on public.student_enrollments;
create trigger project_active_enrollment_class
after insert or update on public.student_enrollments
for each row execute function private.project_active_enrollment_class();

-- Backfill sans perte : une inscription active est créée pour chaque élève historique.
insert into public.student_enrollments (
  student_id, school_id, academic_year_id, class_id, status, starts_on, created_by, created_at, updated_at
)
select
  s.id,
  s.school_id,
  c.academic_year_id,
  s.class_id,
  'active',
  s.created_at::date,
  s.created_by,
  s.created_at,
  s.updated_at
from public.students s
left join public.classes c on c.id = s.class_id
where s.lifecycle_status = 'active'
on conflict (student_id, status) do nothing;

insert into public.student_enrollment_events (
  enrollment_id, student_id, event_type, from_status, to_status, actor_profile_id, payload, created_at
)
select e.id, e.student_id, 'enrollment.inherited', null, 'active', e.created_by,
       jsonb_build_object('class_id', e.class_id, 'academic_year_id', e.academic_year_id), e.created_at
from public.student_enrollments e
where e.status = 'active'
  and not exists (
    select 1 from public.student_enrollment_events ev where ev.enrollment_id = e.id
  );

create or replace function private.create_inherited_enrollment_after_student()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_year_id uuid;
  v_enrollment_id uuid;
begin
  if new.lifecycle_status <> 'active' then return new; end if;
  select academic_year_id into v_year_id from public.classes where id = new.class_id;
  insert into public.student_enrollments (
    student_id, school_id, academic_year_id, class_id, status, starts_on, created_by
  ) values (
    new.id, new.school_id, v_year_id, new.class_id, 'active', new.created_at::date, new.created_by
  ) returning id into v_enrollment_id;
  insert into public.student_enrollment_events (
    enrollment_id, student_id, event_type, to_status, actor_profile_id, payload
  ) values (
    v_enrollment_id, new.id, 'enrollment.inherited', 'active', new.created_by,
    jsonb_build_object('class_id', new.class_id, 'academic_year_id', v_year_id)
  );
  return new;
end
$$;

drop trigger if exists create_inherited_enrollment_after_student on public.students;
create trigger create_inherited_enrollment_after_student
after insert on public.students
for each row execute function private.create_inherited_enrollment_after_student();

-- ============================================================
-- 5. Vérification opérationnelle centrale et isolation des modules
-- ============================================================
create or replace function public.is_student_operational(student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.students s
    join public.student_enrollments e
      on e.student_id = s.id and e.status = 'active'
    join public.classes c on c.id = e.class_id
    where s.id = student_id
      and s.lifecycle_status = 'active'
      and s.class_id is not null
      and s.class_id = e.class_id
      and e.school_id = s.school_id
      and c.school_id = s.school_id
      and e.academic_year_id is not null
      and c.academic_year_id = e.academic_year_id
      and (select count(*) from public.student_enrollments x where x.student_id = s.id and x.status = 'active') = 1
  )
$$;

create or replace function public.count_operational_students(p_school_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.students s
  where s.school_id = p_school_id
    and public.is_student_operational(s.id)
$$;

revoke all on function public.is_student_operational(uuid) from public, anon, authenticated;
revoke all on function public.count_operational_students(uuid) from public, anon, authenticated;
grant execute on function public.is_student_operational(uuid) to service_role;
grant execute on function public.count_operational_students(uuid) to service_role;

create or replace function private.require_operational_student()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_student_operational(new.student_id) then
    raise check_violation using message = 'Student is not operational';
  end if;
  return new;
end
$$;

do $$
declare v_table text;
begin
  foreach v_table in array array[
    'card_print_requests', 'student_cards', 'security_events', 'student_fees',
    'fee_control_scans', 'grades', 'ranking_entries', 'ranking_stars'
  ] loop
    execute format('drop trigger if exists require_operational_student on public.%I', v_table);
    execute format(
      'create trigger require_operational_student before insert or update of student_id on public.%I for each row execute function private.require_operational_student()',
      v_table
    );
  end loop;
end
$$;

create or replace function public.increment_card_print_count(student_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare new_count integer;
begin
  if not public.is_student_operational(student_id) then
    raise check_violation using message = 'Student is not operational';
  end if;
  update public.students
  set card_print_count = card_print_count + 1,
      card_printed = true,
      card_print_date = current_date
  where id = student_id
  returning card_print_count into new_count;
  return new_count;
end
$$;

revoke all on function public.increment_card_print_count(uuid) from public, anon, authenticated;
grant execute on function public.increment_card_print_count(uuid) to service_role;

-- ============================================================
-- 6. Permission dédiée et grant initial Admin
-- ============================================================
insert into public.permissions (code, description)
values ('school.student.create', 'Créer un dossier élève en préparation')
on conflict (code) do update set description = excluded.description;

insert into public.role_permission_grants (role_id, permission_id, allowed)
select r.id, p.id, true
from public.roles r
join public.permissions p on p.code = 'school.student.create'
where r.code = 'admin'
on conflict (role_id, permission_id) do update set allowed = true;

-- ============================================================
-- 7. RLS : drafts administratifs, actifs par portée, aucune écriture directe B1
-- ============================================================
alter table public.student_enrollments enable row level security;
alter table public.student_enrollment_events enable row level security;
alter table public.parent_invitations enable row level security;

revoke all on table public.student_enrollments from anon, authenticated;
revoke all on table public.student_enrollment_events from anon, authenticated;
revoke all on table public.parent_invitations from anon, authenticated;
grant select on table public.student_enrollments to authenticated;
grant select on table public.student_enrollment_events to authenticated;

revoke insert, update, delete on table public.students from authenticated;
revoke insert, update, delete on table public.student_guardians from authenticated;
grant select on table public.students to authenticated;
grant select on table public.student_guardians to authenticated;

drop policy if exists students_current_school on public.students;
drop policy if exists students_select_b1 on public.students;
create policy students_select_b1
on public.students
for select
to authenticated
using (
  school_id = public.current_school_id()
  and (
    public.has_permission('school.manage')
    or public.has_permission('school.student.create')
    or (
      lifecycle_status = 'active'
      and public.has_permission('school.student.read')
      and (
        public.has_scope('school', null)
        or public.has_scope('assigned_classes', class_id)
        or private.current_profile_teaches_class(class_id)
        or private.current_profile_is_guardian(id)
      )
    )
    or (
      lifecycle_status = 'active'
      and public.has_permission('school.guardian.read')
      and private.current_profile_is_guardian(id)
    )
  )
);

drop policy if exists student_guardians_current_school on public.student_guardians;
drop policy if exists student_guardians_select_b1 on public.student_guardians;
create policy student_guardians_select_b1
on public.student_guardians
for select
to authenticated
using (
  school_id = public.current_school_id()
  and (
    profile_id = public.current_profile_id()
    or public.has_permission('school.manage')
    or public.has_permission('school.student.create')
    or (
      public.has_permission('school.guardian.read')
      and exists (select 1 from public.students s where s.id = student_guardians.student_id)
    )
  )
);

create policy student_enrollments_select_b1
on public.student_enrollments
for select
to authenticated
using (
  school_id = public.current_school_id()
  and exists (select 1 from public.students s where s.id = student_enrollments.student_id)
);

create policy student_enrollment_events_select_b1
on public.student_enrollment_events
for select
to authenticated
using (
  exists (select 1 from public.students s where s.id = student_enrollment_events.student_id)
);

drop policy if exists profiles_select_parent_candidates_b1 on public.profiles;
create policy profiles_select_parent_candidates_b1
on public.profiles
for select
to authenticated
using (
  school_id = public.current_school_id()
  and public.has_permission('school.student.create')
  and private.profile_has_role(id, 'parent')
);

-- ============================================================
-- 8. Création atomique et compensation d'invitation
-- ============================================================
create or replace function public.create_student_draft(
  p_school_id uuid,
  p_actor_profile_id uuid,
  p_matricule text,
  p_first_name text,
  p_middle_name text,
  p_last_name text,
  p_date_of_birth date,
  p_gender text,
  p_academic_year_id uuid,
  p_planned_class_id uuid,
  p_enrollment_starts_on date,
  p_guardian_type text,
  p_existing_parent_profile_id uuid,
  p_invited_parent_email text,
  p_invited_parent_first_name text,
  p_invited_parent_last_name text,
  p_invited_parent_phone text,
  p_invitation_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
  v_enrollment_id uuid;
  v_parent_profile_id uuid;
  v_parent_status text;
  v_parent_role_id uuid;
  v_class_school_id uuid;
  v_class_year_id uuid;
  v_year_school_id uuid;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = p_actor_profile_id and p.school_id = p_school_id and p.is_active = true
  ) then
    raise insufficient_privilege using message = 'Actor profile does not belong to the school';
  end if;
  if not private.profile_has_permission(p_actor_profile_id, 'school.student.create') then
    raise insufficient_privilege using message = 'school.student.create is required';
  end if;

  select school_id, academic_year_id into v_class_school_id, v_class_year_id
  from public.classes where id = p_planned_class_id;
  select school_id into v_year_school_id
  from public.academic_years where id = p_academic_year_id;
  if v_class_school_id is distinct from p_school_id
    or v_year_school_id is distinct from p_school_id
    or v_class_year_id is distinct from p_academic_year_id then
    raise check_violation using message = 'Class and academic year must belong to the actor school';
  end if;

  if (p_existing_parent_profile_id is null) = (p_invited_parent_email is null) then
    raise check_violation using message = 'Exactly one primary parent mode is required';
  end if;
  if p_guardian_type not in ('pere', 'mere', 'tuteur', 'autre') then
    raise check_violation using message = 'Invalid guardian type';
  end if;

  if p_existing_parent_profile_id is not null then
    if not exists (
      select 1 from public.profiles p
      where p.id = p_existing_parent_profile_id
        and p.school_id = p_school_id
        and p.account_status = 'active'
        and private.profile_has_role(p.id, 'parent')
    ) then
      raise check_violation using message = 'Existing parent must be an active Parent from the same school';
    end if;
    v_parent_profile_id := p_existing_parent_profile_id;
    v_parent_status := 'active';
  else
    if p_invitation_token_hash is null or p_invitation_token_hash !~ '^[a-f0-9]{64}$' then
      raise check_violation using message = 'Invitation token hash must be SHA-256 hexadecimal';
    end if;
    select id into v_parent_role_id from public.roles where code = 'parent';
    if v_parent_role_id is null then
      raise check_violation using message = 'Parent role is missing';
    end if;
    insert into public.profiles (
      auth_user_id, school_id, display_name, first_name, last_name, phone, email, is_active, account_status
    ) values (
      null, p_school_id,
      trim(concat_ws(' ', p_invited_parent_first_name, p_invited_parent_last_name)),
      p_invited_parent_first_name, p_invited_parent_last_name, p_invited_parent_phone,
      lower(trim(p_invited_parent_email)), false, 'pending_activation'
    ) returning id into v_parent_profile_id;
    insert into public.profile_roles (profile_id, role_id)
    values (v_parent_profile_id, v_parent_role_id);
    v_parent_status := 'pending_activation';
  end if;

  insert into public.students (
    school_id, class_id, matricule, first_name, middle_name, last_name,
    date_of_birth, gender, lifecycle_status, created_by
  ) values (
    p_school_id, null, trim(p_matricule), trim(p_first_name), nullif(trim(p_middle_name), ''), trim(p_last_name),
    p_date_of_birth, p_gender, 'draft', p_actor_profile_id
  ) returning id into v_student_id;

  insert into public.student_enrollments (
    student_id, school_id, academic_year_id, class_id, status, starts_on, created_by
  ) values (
    v_student_id, p_school_id, p_academic_year_id, p_planned_class_id, 'draft',
    p_enrollment_starts_on, p_actor_profile_id
  ) returning id into v_enrollment_id;

  insert into public.student_enrollment_events (
    enrollment_id, student_id, event_type, from_status, to_status, actor_profile_id, payload
  ) values (
    v_enrollment_id, v_student_id, 'enrollment.draft.created', null, 'draft', p_actor_profile_id,
    jsonb_build_object('school_id', p_school_id, 'academic_year_id', p_academic_year_id, 'planned_class_id', p_planned_class_id)
  );

  insert into public.student_guardians (
    school_id, student_id, profile_id, guardian_type, is_primary, full_name,
    phone, email, is_authorized_pickup, created_by
  )
  select p_school_id, v_student_id, p.id, p_guardian_type, true, p.display_name,
         p.phone, p.email, false, p_actor_profile_id
  from public.profiles p where p.id = v_parent_profile_id;

  if v_parent_status = 'pending_activation' then
    insert into public.parent_invitations (
      school_id, profile_id, student_id, email, token_hash, status, expires_at, invited_by
    ) values (
      p_school_id, v_parent_profile_id, v_student_id, lower(trim(p_invited_parent_email)),
      p_invitation_token_hash, 'pending_activation', now() + interval '72 hours', p_actor_profile_id
    );
  end if;

  insert into public.audit_events (school_id, actor_profile_id, event_type, payload)
  values (
    p_school_id, p_actor_profile_id, 'student.draft.created',
    jsonb_build_object(
      'student_id', v_student_id,
      'enrollment_id', v_enrollment_id,
      'lifecycle_status', 'draft',
      'enrollment_status', 'draft',
      'academic_year_id', p_academic_year_id,
      'planned_class_id', p_planned_class_id,
      'primary_parent_profile_id', v_parent_profile_id,
      'parent_account_status', v_parent_status
    )
  );

  return jsonb_build_object(
    'id', v_student_id,
    'lifecycle_status', 'draft',
    'class_id', null,
    'enrollment_status', 'draft',
    'parent', jsonb_build_object('id', v_parent_profile_id, 'account_status', v_parent_status)
  );
end
$$;

create or replace function public.compensate_student_draft_creation(
  p_student_id uuid,
  p_actor_profile_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school_id uuid;
  v_parent_profile_id uuid;
begin
  select s.school_id into v_school_id
  from public.students s
  where s.id = p_student_id
    and s.lifecycle_status = 'draft'
    and s.created_by = p_actor_profile_id
  for update;
  if v_school_id is null then
    raise check_violation using message = 'Compensation target is not an owned draft';
  end if;

  select sg.profile_id into v_parent_profile_id
  from public.student_guardians sg
  join public.profiles p on p.id = sg.profile_id
  where sg.student_id = p_student_id
    and sg.is_primary = true
    and p.account_status = 'pending_activation'
    and p.auth_user_id is null;

  delete from public.students where id = p_student_id;

  if v_parent_profile_id is not null
    and not exists (select 1 from public.student_guardians where profile_id = v_parent_profile_id) then
    delete from public.profiles where id = v_parent_profile_id;
  end if;

  insert into public.audit_events (school_id, actor_profile_id, event_type, payload)
  values (
    v_school_id, p_actor_profile_id, 'student.draft.compensated',
    jsonb_build_object('student_id', p_student_id, 'parent_profile_id', v_parent_profile_id)
  );
  return true;
end
$$;

revoke all on function public.create_student_draft(
  uuid, uuid, text, text, text, text, date, text, uuid, uuid, date, text,
  uuid, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.compensate_student_draft_creation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_student_draft(
  uuid, uuid, text, text, text, text, date, text, uuid, uuid, date, text,
  uuid, text, text, text, text, text
) to service_role;
grant execute on function public.compensate_student_draft_creation(uuid, uuid) to service_role;

comment on column public.students.lifecycle_status is 'draft = EN PRÉPARATION ; active = élève historique/opérationnel';
comment on table public.student_enrollments is 'Source de vérité des inscriptions ; students.class_id est uniquement sa projection active';
comment on table public.parent_invitations is 'Invitations Parent pending_activation ; token stocké exclusivement sous forme SHA-256';
comment on function public.is_student_operational(uuid) is 'Vérifie statut actif, inscription active unique et cohérence année/classe/projection';
