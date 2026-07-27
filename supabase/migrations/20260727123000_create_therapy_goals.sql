-- Sprint 3.1: Objetivos terapéuticos
create table if not exists public.therapy_goals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  psychologist_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'active' check (status in ('pending','active','completed','cancelled')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  progress integer not null default 0 check (progress between 0 and 100),
  start_date date not null default current_date,
  target_date date,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists therapy_goals_patient_id_idx on public.therapy_goals(patient_id);
create index if not exists therapy_goals_status_idx on public.therapy_goals(status);

alter table public.therapy_goals enable row level security;

create policy "Authenticated users can view therapy goals"
on public.therapy_goals for select
to authenticated
using (true);

create policy "Authenticated users can create therapy goals"
on public.therapy_goals for insert
to authenticated
with check (auth.uid() is not null);

create policy "Authenticated users can update therapy goals"
on public.therapy_goals for update
to authenticated
using (true)
with check (auth.uid() is not null);

create policy "Authenticated users can delete therapy goals"
on public.therapy_goals for delete
to authenticated
using (true);

create or replace function public.set_therapy_goal_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at = coalesce(new.completed_at, now());
    new.progress = 100;
  elsif new.status <> 'completed' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists therapy_goals_set_updated_at on public.therapy_goals;
create trigger therapy_goals_set_updated_at
before update on public.therapy_goals
for each row execute function public.set_therapy_goal_updated_at();
