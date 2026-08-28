import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSmtpSettings } from '@/lib/smtp-settings';

function roleNameOf(value: unknown): string | undefined {
  const role = Array.isArray(value) ? value[0] : value;
  if (!role || typeof role !== 'object' || !('name' in role)) return undefined;
  return typeof role.name === 'string' ? role.name : undefined;
}

async function adminOnly(req: NextRequest) {
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

export async function POST(req: NextRequest) {
  if (!(await adminOnly(req))) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  try {
    const { to } = await req.json();

    if (!to || typeof to !== 'string') {
      return NextResponse.json({ error: 'Captura un correo para la prueba.' }, { status: 400 });
    }

    const smtp = await getSmtpSettings();

    if (!smtp) {
      return NextResponse.json(
        { error: 'Primero guarda la configuración SMTP.' },
        { status: 400 }
      );
    }

    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.username,
        pass: smtp.password,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });

    await transport.verify();
    await transport.sendMail({
      from: `${smtp.fromName} <${smtp.fromEmail}>`,
      to: to.trim().toLowerCase(),
      subject: 'Prueba SMTP de PsyCore',
      html: '<h2>Configuración correcta</h2><p>PsyCore puede enviar correos correctamente.</p>',
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('SMTP test error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo conectar con el servidor SMTP.',
      },
      { status: 500 }
    );
  }
}
