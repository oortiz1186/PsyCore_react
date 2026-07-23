create table if not exists public.smtp_settings (
  id integer primary key default 1 check (id = 1),
  host text not null,
  port integer not null default 587,
  secure boolean not null default false,
  username text not null,
  password_encrypted text not null,
  from_email text not null,
  from_name text not null default 'PsyCore',
  app_url text not null default 'http://localhost:3000',
  updated_at timestamptz not null default now()
);

alter table public.smtp_settings enable row level security;

-- No se crean políticas públicas. Esta tabla solo se consulta mediante
-- las rutas privadas de Next.js usando SUPABASE_SERVICE_ROLE_KEY.
