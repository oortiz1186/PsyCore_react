-- Endurece el acceso a los módulos nuevos usando el mismo alcance por psicóloga
-- ya aplicado a patients/appointments. La service role de APIs públicas sigue
-- fuera de RLS, por lo que esas rutas deben mantener validación explícita.

begin;

create or replace function public.can_access_patient(target_patient_id bigint)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.patients p where p.id=target_patient_id and public.can_access_psychologist(p.psychologist_id));
$$;
grant execute on function public.can_access_patient(bigint) to authenticated;

do $$ declare t text; p record; begin
 foreach t in array array['clinical_histories','treatment_plans','treatment_objectives','patient_consents','therapy_homework','patient_portal_invites','appointment_reminders','billing_items','payments','audit_events','service_rates','payment_receipts'] loop
  for p in select policyname from pg_policies where schemaname='public' and tablename=t loop execute format('drop policy if exists %I on public.%I',p.policyname,t); end loop;
 end loop;
end $$;

create policy clinical_histories_scope on public.clinical_histories for all to authenticated using(public.can_access_patient(patient_id)) with check(public.can_access_patient(patient_id));
create policy treatment_plans_scope on public.treatment_plans for all to authenticated using(public.can_access_patient(patient_id)) with check(public.can_access_patient(patient_id));
create policy treatment_objectives_scope on public.treatment_objectives for all to authenticated using(exists(select 1 from public.treatment_plans tp where tp.id=treatment_plan_id and public.can_access_patient(tp.patient_id))) with check(exists(select 1 from public.treatment_plans tp where tp.id=treatment_plan_id and public.can_access_patient(tp.patient_id)));
create policy patient_consents_scope on public.patient_consents for all to authenticated using(public.can_access_patient(patient_id)) with check(public.can_access_patient(patient_id));
create policy therapy_homework_scope on public.therapy_homework for all to authenticated using(public.can_access_patient(patient_id)) with check(public.can_access_patient(patient_id));
create policy portal_invites_scope on public.patient_portal_invites for all to authenticated using(public.can_access_patient(patient_id)) with check(public.can_access_patient(patient_id));
create policy reminders_scope on public.appointment_reminders for all to authenticated using(exists(select 1 from public.appointments a where a.id=appointment_id and public.can_access_psychologist(a.psychologist_id))) with check(exists(select 1 from public.appointments a where a.id=appointment_id and public.can_access_psychologist(a.psychologist_id)));
create policy billing_items_scope on public.billing_items for all to authenticated using(public.can_access_patient(patient_id)) with check(public.can_access_patient(patient_id));
create policy payments_scope on public.payments for all to authenticated using(exists(select 1 from public.billing_items b where b.id=billing_item_id and public.can_access_patient(b.patient_id))) with check(exists(select 1 from public.billing_items b where b.id=billing_item_id and public.can_access_patient(b.patient_id)));
create policy service_rates_scope on public.service_rates for all to authenticated using(public.can_access_psychologist(psychologist_id)) with check(public.can_access_psychologist(psychologist_id));
create policy payment_receipts_scope on public.payment_receipts for all to authenticated using(exists(select 1 from public.payments p join public.billing_items b on b.id=p.billing_item_id where p.id=payment_id and public.can_access_patient(b.patient_id))) with check(exists(select 1 from public.payments p join public.billing_items b on b.id=p.billing_item_id where p.id=payment_id and public.can_access_patient(b.patient_id)));

-- Auditoría: usuarios clínicos pueden consultar eventos de pacientes a los que
-- tienen acceso. Solo administradores pueden consultar eventos sin paciente.
create policy audit_events_select_scope on public.audit_events for select to authenticated using((patient_id is not null and public.can_access_patient(patient_id)) or public.current_role_name()='Administrador');
create policy audit_events_insert_scope on public.audit_events for insert to authenticated with check(actor_id=auth.uid() and (patient_id is null or public.can_access_patient(patient_id)));

commit;
notify pgrst,'reload schema';
