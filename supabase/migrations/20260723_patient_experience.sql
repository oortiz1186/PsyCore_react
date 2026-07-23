alter table public.patients add column if not exists preferred_name text;
alter table public.patients add column if not exists status text not null default 'Activo';
alter table public.patients add column if not exists clinical_alert text;
alter table public.patients add column if not exists updated_at timestamptz not null default now();

create index if not exists patients_status_idx on public.patients(status);
create index if not exists patients_psychologist_status_idx on public.patients(psychologist_id,status);
