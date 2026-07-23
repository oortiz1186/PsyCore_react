alter table public.patients add column if not exists first_name text;
alter table public.patients add column if not exists last_name text;
alter table public.patients add column if not exists email text;
alter table public.patients add column if not exists phone text;
alter table public.patients add column if not exists birth_date date;
alter table public.patients add column if not exists created_by uuid references auth.users(id);
alter table public.patients add column if not exists created_at timestamptz not null default now();

alter table public.appointments add column if not exists starts_at timestamptz;
alter table public.appointments add column if not exists status text default 'Programada';
alter table public.appointments add column if not exists notes text;
alter table public.appointments add column if not exists created_by uuid references auth.users(id);
alter table public.appointments add column if not exists created_at timestamptz not null default now();

alter table public.clinical_notes add column if not exists note_date timestamptz default now();
alter table public.clinical_notes add column if not exists subjective text;
alter table public.clinical_notes add column if not exists objective text;
alter table public.clinical_notes add column if not exists assessment text;
alter table public.clinical_notes add column if not exists plan text;
alter table public.clinical_notes add column if not exists created_by uuid references auth.users(id);
alter table public.clinical_notes add column if not exists created_at timestamptz not null default now();
