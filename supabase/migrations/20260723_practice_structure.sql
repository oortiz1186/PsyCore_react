-- Base operativa para consultorios, horarios y agenda multi-psicóloga.

alter table public.profiles
  add column if not exists calendar_color text default '#7567c7',
  add column if not exists default_session_minutes integer not null default 50;

create table if not exists public.practice_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  room_type text not null default 'Presencial' check (room_type in ('Presencial','Online')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.psychologist_schedules (
  id uuid primary key default gen_random_uuid(),
  psychologist_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  room_id uuid references public.practice_rooms(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (psychologist_id, weekday, start_time, end_time)
);

alter table public.appointments
  add column if not exists room_id uuid references public.practice_rooms(id) on delete set null,
  add column if not exists duration_minutes integer not null default 50,
  add column if not exists consultation_mode text not null default 'Presencial' check (consultation_mode in ('Presencial','Online'));

alter table public.practice_rooms enable row level security;
alter table public.psychologist_schedules enable row level security;

-- Administrador y recepcionista pueden administrar consultorios.
drop policy if exists practice_rooms_read on public.practice_rooms;
create policy practice_rooms_read on public.practice_rooms
for select to authenticated using (true);

drop policy if exists practice_rooms_manage on public.practice_rooms;
create policy practice_rooms_manage on public.practice_rooms
for all to authenticated
using (public.current_role_name() in ('Administrador','Recepcionista'))
with check (public.current_role_name() in ('Administrador','Recepcionista'));

-- Cada psicóloga ve su horario; asistente ve el horario de su psicóloga;
-- administración y recepción ven todos.
drop policy if exists psychologist_schedules_read on public.psychologist_schedules;
create policy psychologist_schedules_read on public.psychologist_schedules
for select to authenticated using (
  public.current_role_name() in ('Administrador','Recepcionista')
  or psychologist_id = public.current_psychologist_id()
);

drop policy if exists psychologist_schedules_manage on public.psychologist_schedules;
create policy psychologist_schedules_manage on public.psychologist_schedules
for all to authenticated
using (
  public.current_role_name() = 'Administrador'
  or (public.current_role_name() = 'Psicóloga' and psychologist_id = auth.uid())
)
with check (
  public.current_role_name() = 'Administrador'
  or (public.current_role_name() = 'Psicóloga' and psychologist_id = auth.uid())
);

create index if not exists idx_psychologist_schedules_psychologist
  on public.psychologist_schedules(psychologist_id, weekday);
create index if not exists idx_appointments_room
  on public.appointments(room_id);
