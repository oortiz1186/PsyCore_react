create table if not exists public.soap_notes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid null references public.appointments(id) on delete set null,
  session_date date not null default current_date,
  subjective text not null,
  objective text not null,
  assessment text not null,
  plan text not null,
  status text not null default 'Borrador' check (status in ('Borrador', 'Finalizada')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_soap_notes_patient_date
  on public.soap_notes(patient_id, session_date desc);

create index if not exists idx_soap_notes_appointment
  on public.soap_notes(appointment_id)
  where appointment_id is not null;

alter table public.soap_notes enable row level security;

drop policy if exists "soap_notes_select_assigned" on public.soap_notes;
create policy "soap_notes_select_assigned"
on public.soap_notes for select
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1 from public.patients p
    where p.id = soap_notes.patient_id
      and p.psychologist_id = auth.uid()
  )
);

drop policy if exists "soap_notes_insert_assigned" on public.soap_notes;
create policy "soap_notes_insert_assigned"
on public.soap_notes for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.patients p
    where p.id = soap_notes.patient_id
      and p.psychologist_id = auth.uid()
  )
);

drop policy if exists "soap_notes_update_own_draft" on public.soap_notes;
create policy "soap_notes_update_own_draft"
on public.soap_notes for update
to authenticated
using (created_by = auth.uid() and status = 'Borrador')
with check (created_by = auth.uid());

comment on table public.soap_notes is 'Notas clínicas estructuradas en formato SOAP por paciente y sesión.';
comment on column public.soap_notes.status is 'Borrador permite edición; Finalizada queda bloqueada desde la aplicación y por la política de actualización.';
