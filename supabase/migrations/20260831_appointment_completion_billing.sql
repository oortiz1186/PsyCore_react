alter table public.appointments
  add column if not exists service_rate_id bigint references public.service_rates(id) on delete set null,
  add column if not exists completed_at timestamptz;

create index if not exists idx_appointments_service_rate on public.appointments(service_rate_id) where service_rate_id is not null;
