create table if not exists public.patient_evaluations (
  id uuid primary key default gen_random_uuid(),
  patient_id bigint not null references public.patients(id) on delete cascade,
  appointment_id bigint null references public.appointments(id) on delete set null,
  instrument text not null check (instrument in ('PHQ-9','GAD-7','Evaluación libre')),
  custom_instrument_name text null,
  evaluation_date date not null default current_date,
  answers jsonb not null default '{}'::jsonb,
  total_score integer null check (total_score is null or total_score >= 0),
  severity text null,
  interpretation text null,
  observations text null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_patient_evaluations_patient_date
  on public.patient_evaluations(patient_id, evaluation_date desc);

create index if not exists idx_patient_evaluations_appointment
  on public.patient_evaluations(appointment_id)
  where appointment_id is not null;

alter table public.patient_evaluations enable row level security;

drop policy if exists "patient_evaluations_select_assigned" on public.patient_evaluations;
create policy "patient_evaluations_select_assigned"
on public.patient_evaluations for select
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1 from public.patients p
    where p.id = patient_evaluations.patient_id
      and p.psychologist_id = auth.uid()
  )
);

drop policy if exists "patient_evaluations_insert_assigned" on public.patient_evaluations;
create policy "patient_evaluations_insert_assigned"
on public.patient_evaluations for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.patients p
    where p.id = patient_evaluations.patient_id
      and p.psychologist_id = auth.uid()
  )
);

drop policy if exists "patient_evaluations_delete_creator" on public.patient_evaluations;
create policy "patient_evaluations_delete_creator"
on public.patient_evaluations for delete
to authenticated
using (created_by = auth.uid());

comment on table public.patient_evaluations is 'Evaluaciones psicológicas por paciente, incluyendo PHQ-9, GAD-7 e instrumentos libres.';