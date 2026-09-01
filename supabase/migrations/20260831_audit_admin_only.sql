begin;

drop policy if exists audit_events_select_scope on public.audit_events;
create policy audit_events_select_admin on public.audit_events
for select to authenticated
using (public.current_role_name() = 'Administrador');

-- Los usuarios pueden seguir registrando sus propios eventos dentro de su alcance.
drop policy if exists audit_events_insert_scope on public.audit_events;
create policy audit_events_insert_scope on public.audit_events
for insert to authenticated
with check (
  actor_id = auth.uid()
  and (patient_id is null or public.can_access_patient(patient_id))
);

commit;
notify pgrst, 'reload schema';
