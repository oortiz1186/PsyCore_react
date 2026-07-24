-- Mantiene compatibilidad con la columna heredada appointment_date.
-- La agenda moderna usa starts_at como fuente de verdad.

begin;

create or replace function public.sync_appointment_legacy_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.starts_at is not null then
    new.appointment_date := (new.starts_at at time zone 'America/Mexico_City')::date;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_appointment_legacy_fields on public.appointments;
create trigger trg_sync_appointment_legacy_fields
before insert or update of starts_at
on public.appointments
for each row
execute function public.sync_appointment_legacy_fields();

update public.appointments
set appointment_date = (starts_at at time zone 'America/Mexico_City')::date
where starts_at is not null
  and appointment_date is distinct from (starts_at at time zone 'America/Mexico_City')::date;

notify pgrst, 'reload schema';

commit;
