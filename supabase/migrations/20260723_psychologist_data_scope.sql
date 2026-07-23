-- Alcance de datos por psicóloga.
-- Administrador y Recepcionista: acceso global.
-- Psicóloga: únicamente sus datos.
-- Asistente: datos de su psicóloga asignada y su propio perfil.

alter table public.profiles
  add column if not exists psychologist_id uuid references public.profiles(id) on delete set null;

create index if not exists idx_profiles_psychologist_id
  on public.profiles(psychologist_id);

alter table public.patients
  add column if not exists psychologist_id uuid references public.profiles(id) on delete restrict;

alter table public.appointments
  add column if not exists psychologist_id uuid references public.profiles(id) on delete restrict;

alter table public.clinical_notes
  add column if not exists psychologist_id uuid references public.profiles(id) on delete restrict;

create index if not exists idx_patients_psychologist_id on public.patients(psychologist_id);
create index if not exists idx_appointments_psychologist_id on public.appointments(psychologist_id);
create index if not exists idx_clinical_notes_psychologist_id on public.clinical_notes(psychologist_id);

create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.name
  from public.profiles p
  left join public.roles r on r.id = p.role_id
  where p.id = auth.uid();
$$;

create or replace function public.current_psychologist_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case
    when r.name = 'Psicóloga' then p.id
    when r.name = 'Asistente' then p.psychologist_id
    else null
  end
  from public.profiles p
  left join public.roles r on r.id = p.role_id
  where p.id = auth.uid();
$$;

create or replace function public.can_access_psychologist(target_psychologist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.current_role_name() in ('Administrador', 'Recepcionista') then true
    when public.current_role_name() in ('Psicóloga', 'Asistente')
      then target_psychologist_id = public.current_psychologist_id()
    else false
  end;
$$;

grant execute on function public.current_role_name() to authenticated;
grant execute on function public.current_psychologist_id() to authenticated;
grant execute on function public.can_access_psychologist(uuid) to authenticated;

-- Las psicólogas se vinculan consigo mismas.
update public.profiles p
set psychologist_id = p.id
from public.roles r
where p.role_id = r.id
  and r.name = 'Psicóloga'
  and p.psychologist_id is distinct from p.id;

-- Intento conservador de asignar registros históricos creados por una psicóloga.
update public.patients x
set psychologist_id = x.created_by
from public.profiles p
join public.roles r on r.id = p.role_id
where x.psychologist_id is null
  and x.created_by = p.id
  and r.name = 'Psicóloga';

update public.appointments x
set psychologist_id = coalesce(
  (select psychologist_id from public.patients where id = x.patient_id),
  x.created_by
)
where x.psychologist_id is null;

update public.clinical_notes x
set psychologist_id = coalesce(
  (select psychologist_id from public.patients where id = x.patient_id),
  x.created_by
)
where x.psychologist_id is null;

-- Elimina políticas anteriores de estas tablas para evitar permisos permisivos heredados.
do $$
declare policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'patients', 'appointments', 'clinical_notes')
  loop
    execute format('drop policy if exists %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.appointments enable row level security;
alter table public.clinical_notes enable row level security;

create policy profiles_select_scope on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or public.current_role_name() in ('Administrador', 'Recepcionista')
  or (
    public.current_role_name() = 'Psicóloga'
    and (id = auth.uid() or psychologist_id = auth.uid())
  )
  or (
    public.current_role_name() = 'Asistente'
    and (id = auth.uid() or id = public.current_psychologist_id())
  )
);

create policy profiles_update_self_or_admin on public.profiles
for update to authenticated
using (id = auth.uid() or public.current_role_name() = 'Administrador')
with check (id = auth.uid() or public.current_role_name() = 'Administrador');

create policy patients_select_scope on public.patients
for select to authenticated
using (public.can_access_psychologist(psychologist_id));

create policy patients_insert_scope on public.patients
for insert to authenticated
with check (public.can_access_psychologist(psychologist_id));

create policy patients_update_scope on public.patients
for update to authenticated
using (public.can_access_psychologist(psychologist_id))
with check (public.can_access_psychologist(psychologist_id));

create policy appointments_select_scope on public.appointments
for select to authenticated
using (public.can_access_psychologist(psychologist_id));

create policy appointments_insert_scope on public.appointments
for insert to authenticated
with check (public.can_access_psychologist(psychologist_id));

create policy appointments_update_scope on public.appointments
for update to authenticated
using (public.can_access_psychologist(psychologist_id))
with check (public.can_access_psychologist(psychologist_id));

create policy clinical_notes_select_scope on public.clinical_notes
for select to authenticated
using (public.can_access_psychologist(psychologist_id));

create policy clinical_notes_insert_scope on public.clinical_notes
for insert to authenticated
with check (public.can_access_psychologist(psychologist_id));

create policy clinical_notes_update_scope on public.clinical_notes
for update to authenticated
using (public.can_access_psychologist(psychologist_id))
with check (public.can_access_psychologist(psychologist_id));
