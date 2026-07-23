alter table public.profiles
  add column if not exists created_by uuid null references auth.users(id) on delete set null;

create index if not exists idx_profiles_created_by on public.profiles(created_by);

-- Los triggers antiguos ya fueron eliminados. Estas funciones ya no forman parte
-- del flujo de Next.js y se eliminan para evitar que vuelvan a conectarse por error.
drop function if exists public.handle_new_user() cascade;
drop function if exists public.handle_new_psycore_user() cascade;
