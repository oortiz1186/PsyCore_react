import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

async function resolveInvite(token: string) {
  if (!token || token.length < 20) return { error: 'Invitación no válida.', status: 400 as const };
  const admin = getSupabaseAdmin();
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const { data: invite, error } = await admin
    .from('patient_portal_invites')
    .select('id,patient_id,email,expires_at,accepted_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (error || !invite) return { error: 'Invitación no encontrada.', status: 404 as const };
  if (new Date(invite.expires_at).getTime() < Date.now()) return { error: 'La invitación ha expirado.', status: 410 as const };
  return { admin, invite };
}

export async function GET(_req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const resolved = await resolveInvite(token);
    if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    const { admin, invite } = resolved;

    if (!invite.accepted_at) {
      await admin.from('patient_portal_invites').update({ accepted_at: new Date().toISOString() }).eq('id', invite.id);
    }

    const [patientResult, appointmentsResult, homeworkResult, consentsResult] = await Promise.all([
      admin.from('patients').select('id,first_name,last_name,preferred_name,email,phone').eq('id', invite.patient_id).single(),
      admin.from('appointments').select('id,starts_at,status,consultation_mode').eq('patient_id', invite.patient_id).gte('starts_at', new Date().toISOString()).order('starts_at', { ascending: true }).limit(10),
      admin.from('therapy_homework').select('id,title,instructions,due_at,status,patient_response,completed_at').eq('patient_id', invite.patient_id).order('created_at', { ascending: false }).limit(20),
      admin.from('patient_consents').select('id,consent_type,document_version,document_text,signer_name,signer_relationship,signed_at,revoked_at,created_at').eq('patient_id', invite.patient_id).order('created_at', { ascending: false }).limit(20),
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

export async function POST(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const resolved = await resolveInvite(token);
    if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    const { admin, invite } = resolved;
    const body = await req.json();

    if (body.action === 'homework') {
      const homeworkId = Number(body.homeworkId);
      if (!Number.isSafeInteger(homeworkId) || homeworkId <= 0) return NextResponse.json({ error: 'Tarea no válida.' }, { status: 400 });
      const response = typeof body.response === 'string' ? body.response.trim().slice(0, 5000) : '';
      const complete = Boolean(body.complete);
      const { data: homework } = await admin.from('therapy_homework').select('id,status').eq('id', homeworkId).eq('patient_id', invite.patient_id).maybeSingle();
      if (!homework) return NextResponse.json({ error: 'Tarea no encontrada.' }, { status: 404 });
      if (homework.status === 'cancelled') return NextResponse.json({ error: 'La tarea está cancelada.' }, { status: 409 });
      const { error } = await admin.from('therapy_homework').update({
        patient_response: response || null,
        status: complete ? 'completed' : response ? 'in_progress' : homework.status,
        completed_at: complete ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq('id', homeworkId).eq('patient_id', invite.patient_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'consent') {
      const consentId = Number(body.consentId);
      const signerName = typeof body.signerName === 'string' ? body.signerName.trim().slice(0, 200) : '';
      const signerRelationship = typeof body.signerRelationship === 'string' ? body.signerRelationship.trim().slice(0, 120) : '';
      if (!Number.isSafeInteger(consentId) || consentId <= 0 || !signerName || body.accepted !== true) return NextResponse.json({ error: 'Debes indicar el firmante y aceptar el consentimiento.' }, { status: 400 });
      const { data: consent } = await admin.from('patient_consents').select('id,signed_at,revoked_at').eq('id', consentId).eq('patient_id', invite.patient_id).maybeSingle();
      if (!consent) return NextResponse.json({ error: 'Consentimiento no encontrado.' }, { status: 404 });
      if (consent.revoked_at) return NextResponse.json({ error: 'El consentimiento fue revocado.' }, { status: 409 });
      if (consent.signed_at) return NextResponse.json({ error: 'El consentimiento ya fue aceptado.' }, { status: 409 });
      const { error } = await admin.from('patient_consents').update({ signer_name: signerName, signer_relationship: signerRelationship || null, signed_at: new Date().toISOString() }).eq('id', consentId).eq('patient_id', invite.patient_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Acción no soportada.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo completar la operación.' }, { status: 500 });
  }
}
