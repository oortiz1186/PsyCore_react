import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = req.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

    const admin = getSupabaseAdmin();
    const { data: { user }, error: userError } = await admin.auth.getUser(auth.slice(7));
    if (userError || !user) return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 });

    const { id } = await context.params;
    const appointmentId = Number(id);
    if (!Number.isSafeInteger(appointmentId) || appointmentId <= 0) return NextResponse.json({ error: 'Cita no válida.' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const serviceRateId = body.serviceRateId ? Number(body.serviceRateId) : null;

    const { data: appointment, error: appointmentError } = await admin
      .from('appointments')
      .select('id,patient_id,psychologist_id,status,service_rate_id')
      .eq('id', appointmentId)
      .maybeSingle();

    if (appointmentError || !appointment) return NextResponse.json({ error: 'Cita no encontrada.' }, { status: 404 });
    if (appointment.psychologist_id && appointment.psychologist_id !== user.id) return NextResponse.json({ error: 'No tienes acceso a esta cita.' }, { status: 403 });
    if (['Cancelada','Cancelado','No asistió'].includes(appointment.status || '')) return NextResponse.json({ error: 'La cita no puede completarse en su estado actual.' }, { status: 409 });

    let rate: { id:number; psychologist_id?:string|null; name:string; amount:number; currency:string; active:boolean } | null = null;
    const resolvedRateId = serviceRateId || appointment.service_rate_id || null;
    if (resolvedRateId) {
      const { data, error } = await admin.from('service_rates').select('id,psychologist_id,name,amount,currency,active').eq('id', resolvedRateId).maybeSingle();
      if (error || !data || !data.active) return NextResponse.json({ error: 'La tarifa seleccionada no está disponible.' }, { status: 404 });
      if (data.psychologist_id && data.psychologist_id !== user.id) return NextResponse.json({ error: 'No tienes acceso a esta tarifa.' }, { status: 403 });
      rate = data;
    }

    const completedAt = new Date().toISOString();
    const { error: updateError } = await admin.from('appointments').update({ status: 'Completada', completed_at: completedAt, service_rate_id: resolvedRateId, updated_at: completedAt }).eq('id', appointmentId);
    if (updateError) throw updateError;

    let billingItemId: number | null = null;
    if (rate) {
      const { data: existing } = await admin.from('billing_items').select('id').eq('appointment_id', appointmentId).neq('status','cancelled').maybeSingle();
      if (existing) billingItemId = existing.id;
      else {
        const { data: billing, error: billingError } = await admin.from('billing_items').insert({
          patient_id: appointment.patient_id,
          appointment_id: appointmentId,
          psychologist_id: user.id,
          service_rate_id: rate.id,
          concept: rate.name,
          amount: rate.amount,
          discount: 0,
          currency: rate.currency,
          status: 'pending',
          source: 'appointment_auto',
        }).select('id').single();
        if (billingError) throw billingError;
        billingItemId = billing.id;
      }
    }

    await admin.from('audit_events').insert({
      actor_id: user.id,
      action: 'appointment.completed',
      entity_type: 'appointment',
      entity_id: String(appointmentId),
      patient_id: appointment.patient_id,
      metadata: { billing_item_id: billingItemId, service_rate_id: resolvedRateId, previous_status: appointment.status || null },
    });

    return NextResponse.json({ ok: true, appointmentId, completedAt, billingItemId, charged: Boolean(billingItemId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo completar la cita.' }, { status: 500 });
  }
}
