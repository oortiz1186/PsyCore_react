-- PsyCore: alineación de profiles con usuarios y agenda.
-- Idempotente: puede ejecutarse más de una vez.

begin;

alter table public.profiles
  add column if not exists created_by uuid,
  add column if not exists calendar_color text,
  add column if not exists default_session_minutes integer not null default 50,
  add column if not exists updated_at timestamptz not null default now();

update public.profiles
set default_session_minutes = 50
where default_session_minutes is null
   or default_session_minutes < 15
   or default_session_minutes > 480;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_created_by_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_created_by_fkey
      foreign key (created_by)
      references public.profiles(id)
      on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_default_session_minutes_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_default_session_minutes_check
      check (default_session_minutes between 15 and 480);
  end if;
end $$;

create index if not exists idx_profiles_created_by
  on public.profiles(created_by)
  where created_by is not null;

commit;

notify pgrst, 'reload schema';
