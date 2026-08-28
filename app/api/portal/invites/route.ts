import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

async function authenticatedUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const admin = getSupabaseAdmin();
  const { data } = await admin.auth.getUser(token);
  return data.user || null;
}

export async function POST(req: NextRequest) {
  const user = await authenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const body = await req.json();
    const patientId = Number(body.patientId);
    const email = String(body.email || '').trim().toLowerCase();
    const days = Math.max(1, Math.min(30, Number(body.expiresInDays || 7)));
    if (!Number.isSafeInteger(patientId) || patientId <= 0 || !email) {
      return NextResponse.json({ error: 'Paciente y correo son obligatorios.' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: patient, error: patientError } = await admin.from('patients').select('id,email').eq('id', patientId).maybeSingle();
    if (patientError || !patient) return NextResponse.json({ error: 'Paciente no encontrado.' }, { status: 404 });

    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await admin.from('patient_portal_invites').insert({
      patient_id: patientId,
      email,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: user.id,
    });
    if (error) throw error;

    const origin = new URL(req.url).origin;
    return NextResponse.json({ ok: true, expiresAt, portalUrl: `${origin}/portal/${token}` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo crear la invitación.' }, { status: 500 });
  }
}
