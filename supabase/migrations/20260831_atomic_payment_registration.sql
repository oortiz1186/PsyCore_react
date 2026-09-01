-- Registro de pagos transaccional: evita sobrepagos y estados desincronizados.

begin;

create or replace function public.record_billing_payment(
  p_billing_item_id bigint,
  p_amount numeric,
  p_payment_method text default null,
  p_reference text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.billing_items%rowtype;
  v_total numeric(12,2);
  v_paid numeric(12,2);
  v_remaining numeric(12,2);
  v_payment_id bigint;
begin
  if auth.uid() is null then raise exception 'No autorizado'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'El importe debe ser mayor a cero'; end if;

  select * into v_item from public.billing_items where id=p_billing_item_id for update;
  if not found then raise exception 'Cargo no encontrado'; end if;
  if not public.can_access_patient(v_item.patient_id) then raise exception 'No tienes acceso a este cargo'; end if;
  if v_item.status in ('cancelled','refunded') then raise exception 'El cargo no admite pagos'; end if;

  v_total := greatest(0, coalesce(v_item.amount,0)-coalesce(v_item.discount,0));
  select coalesce(sum(amount),0) into v_paid from public.payments where billing_item_id=v_item.id;
  if v_paid + p_amount > v_total + 0.001 then raise exception 'El pago supera el saldo pendiente'; end if;

  insert into public.payments(billing_item_id,amount,payment_method,reference,received_by)
  values(v_item.id,p_amount,nullif(trim(p_payment_method),''),nullif(trim(p_reference),''),auth.uid())
  returning id into v_payment_id;

  v_remaining := greatest(0,v_total-(v_paid+p_amount));
  update public.billing_items
     set status=case when v_remaining <= 0.001 then 'paid' else 'partial' end,
         updated_at=now()
   where id=v_item.id;

  insert into public.audit_events(actor_id,action,entity_type,entity_id,patient_id,metadata)
  values(auth.uid(),'billing.payment.recorded','payment',v_payment_id::text,v_item.patient_id,
    jsonb_build_object('billing_item_id',v_item.id,'amount',p_amount,'remaining',v_remaining));

  return v_payment_id;
end;
$$;

revoke all on function public.record_billing_payment(bigint,numeric,text,text) from public;
grant execute on function public.record_billing_payment(bigint,numeric,text,text) to authenticated;

commit;
notify pgrst,'reload schema';
