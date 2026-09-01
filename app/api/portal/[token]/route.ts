import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  return response;
}

async function resolveInvite(token: string) {
  if (!token || token.length < 20) return { error: 'Invitación no válida.', status: 400 as const };
  const admin = getSupabaseAdmin();
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const { data: invite, error } = await admin.from('patient_portal_invites').select('id,patient_id,email,expires_at,accepted_at,revoked_at').eq('token_hash', tokenHash).maybeSingle();
  if (error || !invite) return { error: 'Invitación no encontrada.', status: 404 as const };
  if (invite.revoked_at) return { error: 'La invitación fue revocada.', status: 410 as const };
  if (new Date(invite.expires_at).getTime() < Date.now()) return { error: 'La invitación ha expirado.', status: 410 as const };
  return { admin, invite };
}

async function audit(admin: ReturnType<typeof getSupabaseAdmin>, req: NextRequest, patientId: number, action: string, entityType: string, entityId: number | string, metadata: Record<string, unknown> = {}) {
  await admin.from('audit_events').insert({
    actor_id: null,
    action,
    entity_type: entityType,
    entity_id: String(entityId),
    patient_id: patientId,
    metadata: { source: 'patient_portal', ...metadata },
    ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    user_agent: req.headers.get('user-agent')?.slice(0, 500) || null,
  });
}

export async function GET(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const resolved = await resolveInvite(token);
    if ('error' in resolved) return jsonNoStore({ error: resolved.error }, { status: resolved.status });
    const { admin, invite } = resolved;
    if (!invite.accepted_at) {
      const acceptedAt = new Date().toISOString();
      await admin.from('patient_portal_invites').update({ accepted_at: acceptedAt }).eq('id', invite.id).is('accepted_at', null);
      await audit(admin, req, invite.patient_id, 'portal.invite.first_opened', 'patient_portal_invite', invite.id, { acceptedAt });
    }

    const [patientResult, appointmentsResult, homeworkResult, consentsResult] = await Promise.all([
      admin.from('patients').select('id,first_name,last_name,preferred_name').eq('id', invite.patient_id).single(),
      admin.from('appointments').select('id,starts_at,status,consultation_mode').eq('patient_id', invite.patient_id).gte('starts_at', new Date().toISOString()).order('starts_at', { ascending: true }).limit(10),
      admin.from('therapy_homework').select('id,title,instructions,due_at,status,patient_response,completed_at').eq('patient_id', invite.patient_id).order('created_at', { ascending: false }).limit(20),
      admin.from('patient_consents').select('id,consent_type,document_version,document_text,signer_name,signer_relationship,signed_at,revoked_at,created_at').eq('patient_id', invite.patient_id).order('created_at', { ascending: false }).limit(20),
    ]);

    if (patientResult.error || !patientResult.data) return jsonNoStore({ error: 'Paciente no disponible.' }, { status: 404 });
    return jsonNoStore({ patient: patientResult.data, appointments: appointmentsResult.data || [], homework: homeworkResult.data || [], consents: consentsResult.data || [], invite: { email: invite.email, expiresAt: invite.expires_at } });
  } catch (error) {
    return jsonNoStore({ error: error instanceof Error ? error.message : 'No se pudo abrir el portal.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const resolved = await resolveInvite(token);
    if ('error' in resolved) return jsonNoStore({ error: resolved.error }, { status: resolved.status });
    const { admin, invite } = resolved;
    const body = await req.json();

    if (body.action === 'appointment') {
      const appointmentId = Number(body.appointmentId);
      const decision = body.decision === 'confirm' ? 'confirm' : body.decision === 'cancel' ? 'cancel' : null;
      if (!Number.isSafeInteger(appointmentId) || appointmentId <= 0 || !decision) return jsonNoStore({ error: 'Solicitud de cita no válida.' }, { status: 400 });
      const { data: appointment } = await admin.from('appointments').select('id,status,starts_at').eq('id', appointmentId).eq('patient_id', invite.patient_id).maybeSingle();
      if (!appointment) return jsonNoStore({ error: 'Cita no encontrada.' }, { status: 404 });
      if (appointment.starts_at && new Date(appointment.starts_at).getTime() < Date.now()) return jsonNoStore({ error: 'Esta cita ya ocurrió.' }, { status: 409 });
      if (['Completada','No asistió'].includes(appointment.status || '')) return jsonNoStore({ error: 'Esta cita ya no puede modificarse desde el portal.' }, { status: 409 });
      const nextStatus = decision === 'confirm' ? 'Confirmada' : 'Cancelada';
      const { error } = await admin.from('appointments').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', appointmentId).eq('patient_id', invite.patient_id);
      if (error) return jsonNoStore({ error: error.message }, { status: 400 });
      await audit(admin, req, invite.patient_id, decision === 'confirm' ? 'portal.appointment.confirmed' : 'portal.appointment.cancelled', 'appointment', appointmentId, { previousStatus: appointment.status || null, nextStatus });
      return jsonNoStore({ ok: true });
    }

    if (body.action === 'homework') {
      const homeworkId = Number(body.homeworkId);
      if (!Number.isSafeInteger(homeworkId) || homeworkId <= 0) return jsonNoStore({ error: 'Tarea no válida.' }, { status: 400 });
      const response = typeof body.response === 'string' ? body.response.trim().slice(0, 5000) : '';
      const complete = Boolean(body.complete);
      const { data: homework } = await admin.from('therapy_homework').select('id,status').eq('id', homeworkId).eq('patient_id', invite.patient_id).maybeSingle();
      if (!homework) return jsonNoStore({ error: 'Tarea no encontrada.' }, { status: 404 });
      if (homework.status === 'cancelled') return jsonNoStore({ error: 'La tarea está cancelada.' }, { status: 409 });
      const nextStatus = complete ? 'completed' : response ? 'in_progress' : homework.status;
      const { error } = await admin.from('therapy_homework').update({ patient_response: response || null, status: nextStatus, completed_at: complete ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', homeworkId).eq('patient_id', invite.patient_id);
      if (error) return jsonNoStore({ error: error.message }, { status: 400 });
      await audit(admin, req, invite.patient_id, complete ? 'portal.homework.completed' : 'portal.homework.updated', 'therapy_homework', homeworkId, { status: nextStatus });
      return jsonNoStore({ ok: true });
    }

    if (body.action === 'consent') {
      const consentId = Number(body.consentId);
      const signerName = typeof body.signerName === 'string' ? body.signerName.trim().slice(0, 200) : '';
      const signerRelationship = typeof body.signerRelationship === 'string' ? body.signerRelationship.trim().slice(0, 120) : '';
      if (!Number.isSafeInteger(consentId) || consentId <= 0 || !signerName || body.accepted !== true) return jsonNoStore({ error: 'Debes indicar el firmante y aceptar el consentimiento.' }, { status: 400 });
      const { data: consent } = await admin.from('patient_consents').select('id,signed_at,revoked_at').eq('id', consentId).eq('patient_id', invite.patient_id).maybeSingle();
      if (!consent) return jsonNoStore({ error: 'Consentimiento no encontrado.' }, { status: 404 });
      if (consent.revoked_at) return jsonNoStore({ error: 'El consentimiento fue revocado.' }, { status: 409 });
      if (consent.signed_at) return jsonNoStore({ error: 'El consentimiento ya fue aceptado.' }, { status: 409 });
      const signedAt = new Date().toISOString();
      const { error } = await admin.from('patient_consents').update({ signer_name: signerName, signer_relationship: signerRelationship || null, signed_at: signedAt }).eq('id', consentId).eq('patient_id', invite.patient_id);
      if (error) return jsonNoStore({ error: error.message }, { status: 400 });
      await audit(admin, req, invite.patient_id, 'portal.consent.accepted', 'patient_consent', consentId, { signerRelationship: signerRelationship || null, signedAt });
      return jsonNoStore({ ok: true });
    }

    return jsonNoStore({ error: 'Acción no soportada.' }, { status: 400 });
  } catch (error) {
    return jsonNoStore({ error: error instanceof Error ? error.message : 'No se pudo completar la operación.' }, { status: 500 });
  }
}
