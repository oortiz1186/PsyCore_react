begin;

alter table public.calendar_working_hours
  add column if not exists room_id bigint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'calendar_working_hours_room_id_fkey'
      and conrelid = 'public.calendar_working_hours'::regclass
  ) then
    alter table public.calendar_working_hours
      add constraint calendar_working_hours_room_id_fkey
      foreign key (room_id)
      references public.consulting_rooms(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_calendar_working_hours_room
  on public.calendar_working_hours(room_id)
  where room_id is not null;

notify pgrst, 'reload schema';

commit;
