alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists active boolean not null default true;
alter table public.profiles add column if not exists must_change_password boolean not null default false;
alter table public.profiles add column if not exists created_at timestamptz not null default now();

create index if not exists idx_profiles_email on public.profiles(lower(email));

-- La creación administrativa se realiza desde una Route Handler de Next.js
-- usando SUPABASE_SERVICE_ROLE_KEY únicamente en el servidor.
-- Las tablas existentes patients, appointments, clinical_notes, profiles y roles se reutilizan.
