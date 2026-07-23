insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'patient-files',
  'patient-files',
  false,
  10485760,
  array['application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.patient_files (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null,
  display_name text not null,
  document_type text not null default 'Otro' check (document_type in ('Consentimiento','Evaluación','Receta','Estudio','Identificación','Administrativo','Otro')),
  description text null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_patient_files_patient_created
  on public.patient_files(patient_id, created_at desc);

alter table public.patient_files enable row level security;

drop policy if exists "patient_files_select_assigned" on public.patient_files;
create policy "patient_files_select_assigned"
on public.patient_files for select
to authenticated
using (
  uploaded_by = auth.uid()
  or exists (
    select 1 from public.patients p
    where p.id = patient_files.patient_id
      and p.psychologist_id = auth.uid()
  )
);

drop policy if exists "patient_files_insert_assigned" on public.patient_files;
create policy "patient_files_insert_assigned"
on public.patient_files for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1 from public.patients p
    where p.id = patient_files.patient_id
      and p.psychologist_id = auth.uid()
  )
);

drop policy if exists "patient_files_delete_uploader" on public.patient_files;
create policy "patient_files_delete_uploader"
on public.patient_files for delete
to authenticated
using (uploaded_by = auth.uid());

-- Los objetos se organizan como: <patient_id>/<user_id>/<uuid>-archivo.ext
-- Las políticas de Storage validan el paciente y al propietario del archivo.
drop policy if exists "patient_storage_select_assigned" on storage.objects;
create policy "patient_storage_select_assigned"
on storage.objects for select
to authenticated
using (
  bucket_id = 'patient-files'
  and exists (
    select 1 from public.patients p
    where p.id::text = (storage.foldername(name))[1]
      and (p.psychologist_id = auth.uid() or (storage.foldername(name))[2] = auth.uid()::text)
  )
);

drop policy if exists "patient_storage_insert_assigned" on storage.objects;
create policy "patient_storage_insert_assigned"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'patient-files'
  and (storage.foldername(name))[2] = auth.uid()::text
  and exists (
    select 1 from public.patients p
    where p.id::text = (storage.foldername(name))[1]
      and p.psychologist_id = auth.uid()
  )
);

drop policy if exists "patient_storage_delete_owner" on storage.objects;
create policy "patient_storage_delete_owner"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'patient-files'
  and (storage.foldername(name))[2] = auth.uid()::text
);

comment on table public.patient_files is 'Metadatos de archivos clínicos privados almacenados en Supabase Storage.';