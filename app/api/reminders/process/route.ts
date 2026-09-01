import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

function authorized(req: NextRequest) {
  const secret = process.env.REMINDER_CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  try {
    const admin = getSupabaseAdmin();
    const now = new Date().toISOString();
    const { data: reminders, error } = await admin.from('appointment_reminders')
      .select('id,appointment_id,channel,scheduled_at,appointments(starts_at,status,patients(first_name,last_name,email,phone))')
      .eq('status','pending').lte('scheduled_at',now).order('scheduled_at',{ascending:true}).limit(50);
    if (error) throw error;

    let processed=0, cancelled=0, awaitingProvider=0;
    for (const reminder of reminders || []) {
      const appointment = Array.isArray(reminder.appointments) ? reminder.appointments[0] : reminder.appointments;
      if (!appointment || ['Cancelada','Cancelado','Completada'].includes(appointment.status || '')) {
        await admin.from('appointment_reminders').update({status:'cancelled',error_message:'La cita ya no requiere recordatorio.'}).eq('id',reminder.id).eq('status','pending');
        cancelled++; continue;
      }
      const patient = Array.isArray(appointment.patients) ? appointment.patients[0] : appointment.patients;
      const destination = reminder.channel === 'email' ? patient?.email : reminder.channel === 'whatsapp' || reminder.channel === 'sms' ? patient?.phone : null;
      if (reminder.channel === 'portal') {
        await admin.from('appointment_reminders').update({status:'sent',sent_at:now,provider_message_id:`portal:${reminder.id}`,error_message:null}).eq('id',reminder.id).eq('status','pending');
        processed++; continue;
      }
      if (!destination) {
        await admin.from('appointment_reminders').update({status:'failed',error_message:`El paciente no tiene ${reminder.channel === 'email' ? 'correo' : 'teléfono'} registrado.`}).eq('id',reminder.id).eq('status','pending');
        processed++; continue;
      }
      // La integración real del proveedor se conecta aquí. No se marca como enviado hasta recibir confirmación del proveedor.
      await admin.from('appointment_reminders').update({status:'pending',error_message:`Pendiente de configurar proveedor ${reminder.channel}. Destino validado.`}).eq('id',reminder.id).eq('status','pending');
      awaitingProvider++;
    }
    return NextResponse.json({ok:true,found:(reminders||[]).length,processed,cancelled,awaitingProvider});
  } catch (error) {
    return NextResponse.json({error:error instanceof Error?error.message:'No se pudieron procesar los recordatorios.'},{status:500});
  }
}
