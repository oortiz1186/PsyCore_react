import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

type AccessContext = {
  userId: string;
  role: string;
  psychologistId: string | null;
};

async function accessContext(req: NextRequest): Promise<AccessContext | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const admin = getSupabaseAdmin();
  const { data: authData } = await admin.auth.getUser(token);
  const user = authData.user;
  if (!user) return null;

  const { data: profile } = await admin
    .from('profiles')
    .select('id,psychologist_id,roles(name)')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile) return null;

  const rawRole = Array.isArray(profile.roles) ? profile.roles[0]?.name : profile.roles?.name;
  return {
    userId: user.id,
    role: rawRole || '',
    psychologistId: profile.psychologist_id || null,
  };
}

function canAccessPatient(context: AccessContext, patientPsychologistId: string | null) {
  if (context.role === 'Administrador' || context.role === 'Recepcionista') return true;
  if (context.role === 'Psicóloga') return patientPsychologistId === context.userId;
  if (context.role === 'Asistente') return Boolean(context.psychologistId && patientPsychologistId === context.psychologistId);
  return false;
}

async function patientForAccess(patientId: number, context: AccessContext) {
  const admin = getSupabaseAdmin();
  const { data: patient, error } = await admin
    .from('patients')
    .select('id,email,psychologist_id')
    .eq('id', patientId)
    .maybeSingle();
  if (error || !patient) return { error: 'Paciente no encontrado.', status: 404 as const };
  if (!canAccessPatient(context, patient.psychologist_id || null)) return { error: 'No tienes acceso a este paciente.', status: 403 as const };
  return { patient };
}

export async function GET(req: NextRequest) {
  const context = await accessContext(req);
  if (!context) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  const patientId = Number(new URL(req.url).searchParams.get('patientId'));
  if (!Number.isSafeInteger(patientId) || patientId <= 0) return NextResponse.json({ error: 'Paciente no válido.' }, { status: 400 });

  const access = await patientForAccess(patientId, context);
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('patient_portal_invites')
    .select('id,email,expires_at,accepted_at,revoked_at,created_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(25);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ invites: data || [] });
}

export async function POST(req: NextRequest) {
  const context = await accessContext(req);
  if (!context) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const body = await req.json();
    const patientId = Number(body.patientId);
    const email = String(body.email || '').trim().toLowerCase();
    const days = Math.max(1, Math.min(30, Number(body.expiresInDays || 7)));
    if (!Number.isSafeInteger(patientId) || patientId <= 0 || !email || !email.includes('@')) {
      return NextResponse.json({ error: 'Paciente y correo válido son obligatorios.' }, { status: 400 });
    }

    const access = await patientForAccess(patientId, context);
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });

    const admin = getSupabaseAdmin();
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const { data: invite, error } = await admin.from('patient_portal_invites').insert({
      patient_id: patientId,
      email,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: context.userId,
    }).select('id').single();
    if (error) throw error;

    await admin.from('audit_events').insert({
      actor_id: context.userId,
      action: 'portal.invite.created',
      entity_type: 'patient_portal_invite',
      entity_id: String(invite.id),
      patient_id: patientId,
      metadata: { expires_at: expiresAt },
    });

    const origin = new URL(req.url).origin;
    return NextResponse.json({ ok: true, expiresAt, portalUrl: `${origin}/portal/${token}` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo crear la invitación.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const context = await accessContext(req);
  if (!context) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const body = await req.json();
    const inviteId = Number(body.inviteId);
    if (!Number.isSafeInteger(inviteId) || inviteId <= 0) return NextResponse.json({ error: 'Invitación no válida.' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data: invite } = await admin.from('patient_portal_invites').select('id,patient_id,revoked_at').eq('id', inviteId).maybeSingle();
    if (!invite) return NextResponse.json({ error: 'Invitación no encontrada.' }, { status: 404 });

    const access = await patientForAccess(Number(invite.patient_id), context);
    if ('error' in access) return NextResponse.json({ error: access.error }, { status: access.status });
    if (invite.revoked_at) return NextResponse.json({ ok: true, alreadyRevoked: true });

    const revokedAt = new Date().toISOString();
    const { error } = await admin.from('patient_portal_invites').update({ revoked_at: revokedAt, revoked_by: context.userId }).eq('id', inviteId).is('revoked_at', null);
    if (error) throw error;

    await admin.from('audit_events').insert({
      actor_id: context.userId,
      action: 'portal.invite.revoked',
      entity_type: 'patient_portal_invite',
      entity_id: String(inviteId),
      patient_id: Number(invite.patient_id),
      metadata: { revoked_at: revokedAt },
    });
    return NextResponse.json({ ok: true, revokedAt });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo revocar la invitación.' }, { status: 500 });
  }
}
