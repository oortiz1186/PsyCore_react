import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(_req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    if (!token || token.length < 20) return NextResponse.json({ error: 'Invitación no válida.' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const { data: invite, error: inviteError } = await admin
      .from('patient_portal_invites')
      .select('id,patient_id,email,expires_at,accepted_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (inviteError || !invite) return NextResponse.json({ error: 'Invitación no encontrada.' }, { status: 404 });
    if (new Date(invite.expires_at).getTime() < Date.now()) return NextResponse.json({ error: 'La invitación ha expirado.' }, { status: 410 });

    if (!invite.accepted_at) {
      await admin.from('patient_portal_invites').update({ accepted_at: new Date().toISOString() }).eq('id', invite.id);
    }

    const [patientResult, appointmentsResult, homeworkResult, consentsResult] = await Promise.all([
      admin.from('patients').select('id,first_name,last_name,preferred_name,email,phone').eq('id', invite.patient_id).single(),
      admin.from('appointments').select('id,starts_at,status,consultation_mode').eq('patient_id', invite.patient_id).gte('starts_at', new Date().toISOString()).order('starts_at', { ascending: true }).limit(10),
      admin.from('therapy_homework').select('id,title,instructions,due_at,status,patient_response,completed_at').eq('patient_id', invite.patient_id).order('created_at', { ascending: false }).limit(20),
      admin.from('patient_consents').select('id,consent_type,document_version,signer_name,signed_at,revoked_at,created_at').eq('patient_id', invite.patient_id).order('created_at', { ascending: false }).limit(20),
    ]);

    if (patientResult.error || !patientResult.data) return NextResponse.json({ error: 'Paciente no disponible.' }, { status: 404 });

    return NextResponse.json({
      patient: patientResult.data,
      appointments: appointmentsResult.data || [],
      homework: homeworkResult.data || [],
      consents: consentsResult.data || [],
      invite: { email: invite.email, expiresAt: invite.expires_at },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo abrir el portal.' }, { status: 500 });
  }
}
