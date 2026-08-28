import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSmtpSettings, saveSmtpSettings } from '@/lib/smtp-settings';

function roleNameOf(value: unknown): string | undefined {
  const role = Array.isArray(value) ? value[0] : value;
  if (!role || typeof role !== 'object' || !('name' in role)) return undefined;
  return typeof role.name === 'string' ? role.name : undefined;
}

async function isAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return false;

  const admin = getSupabaseAdmin();
  const { data } = await admin.auth.getUser(token);
  if (!data.user) return false;

  const { data: profile } = await admin
    .from('profiles')
    .select('roles(name)')
    .eq('id', data.user.id)
    .maybeSingle();

  const role = roleNameOf(profile?.roles);

  return role === 'Administrador';
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  try {
    const settings = await getSmtpSettings();
    if (!settings) return NextResponse.json({ settings: null });

    return NextResponse.json({
      settings: {
        ...settings,
        password: '',
        passwordConfigured: true,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo leer la configuración.' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const current = await getSmtpSettings();
    const password = body.password || current?.password;

    if (!body.host || !body.port || !body.username || !password || !body.fromEmail) {
      return NextResponse.json(
        { error: 'Servidor, puerto, usuario, contraseña y remitente son obligatorios.' },
        { status: 400 }
      );
    }

    await saveSmtpSettings({
      host: body.host,
      port: Number(body.port),
      secure: Boolean(body.secure),
      username: body.username,
      password,
      fromEmail: body.fromEmail,
      fromName: body.fromName || 'PsyCore',
      appUrl: body.appUrl || 'http://localhost:3000',
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo guardar la configuración.' },
      { status: 500 }
    );
  }
}
