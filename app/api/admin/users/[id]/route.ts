import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSmtpSettings } from '@/lib/smtp-settings';

const ALLOWED_ROLES = ['Administrador', 'Asistente', 'Psicóloga', 'Recepcionista'];

function messageOf(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object') {
    const value = error as { message?: unknown; details?: unknown; hint?: unknown };
    for (const candidate of [value.message, value.details, value.hint]) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate;
    }
  }
  return fallback;
}

function roleNameOf(value: unknown): string | undefined {
  const role = Array.isArray(value) ? value[0] : value;
  if (!role || typeof role !== 'object') return undefined;

  const name = (role as { name?: unknown }).name;
  return typeof name === 'string' ? name : undefined;
}

async function requireAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;

  const admin = getSupabaseAdmin();
  const { data } = await admin.auth.getUser(token);
  if (!data.user) return null;

  const { data: profile } = await admin
    .from('profiles')
    .select('roles(name)')
    .eq('id', data.user.id)
    .maybeSingle();

  const role = roleNameOf(profile?.roles);

  return role === 'Administrador' ? data.user : null;
}

function temporaryPassword() {
  return `Psy-${crypto.randomBytes(8).toString('base64url')}!9`;
}

async function sendAccessEmail(email: string, fullName: string, password: string) {
  const smtp = await getSmtpSettings();
  if (!smtp) throw new Error('No existe configuración SMTP.');

  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.username, pass: smtp.password },
  });

  await transport.sendMail({
    from: `${smtp.fromName} <${smtp.fromEmail}>`,
    to: email,
    subject: 'Nuevo acceso temporal a PsyCore',
    html: `<h2>Hola ${fullName}</h2><p>Se generó un nuevo acceso temporal para tu cuenta.</p><p><strong>Correo:</strong> ${email}</p><p><strong>Contraseña temporal:</strong> ${password}</p><p><a href="${smtp.appUrl}/login">Ingresar a PsyCore</a></p><p>Al iniciar sesión deberás cambiar la contraseña.</p>`,
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const actor = await requireAdmin(req);
  if (!actor) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });

  try {
    const { id } = await context.params;
    const body = await req.json();
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const roleId = Number(body.roleId);
    const active = Boolean(body.active);

    if (!fullName || !email || !/^\S+@\S+\.\S+$/.test(email) || !Number.isInteger(roleId) || roleId <= 0) {
      return NextResponse.json({ error: 'Nombre, correo válido y rol son obligatorios.' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: role, error: roleError } = await admin
      .from('roles')
      .select('id,name')
      .eq('id', roleId)
      .maybeSingle();

    if (roleError || !role || !ALLOWED_ROLES.includes(role.name)) {
      return NextResponse.json({ error: 'El rol seleccionado no está permitido.' }, { status: 400 });
    }

    const { data: existingAuth, error: existingAuthError } = await admin.auth.admin.getUserById(id);
    if (existingAuthError || !existingAuth.user) {
      return NextResponse.json({ error: 'No se encontró el usuario en Supabase Auth.' }, { status: 404 });
    }

    const previousEmail = existingAuth.user.email?.toLowerCase() || '';
    const emailChanged = previousEmail !== email;

    const { error: authError } = await admin.auth.admin.updateUserById(id, {
      email,
      email_confirm: true,
      user_metadata: { ...existingAuth.user.user_metadata, full_name: fullName },
      ban_duration: active ? 'none' : '876000h',
    });

    if (authError) {
      return NextResponse.json(
        { error: messageOf(authError, 'No se pudo actualizar el acceso del usuario.') },
        { status: 400 }
      );
    }

    const { error: profileError } = await admin
      .from('profiles')
      .update({ full_name: fullName, email, role_id: roleId, active })
      .eq('id', id);

    if (profileError) {
      if (emailChanged && previousEmail) {
        await admin.auth.admin.updateUserById(id, {
          email: previousEmail,
          email_confirm: true,
          user_metadata: existingAuth.user.user_metadata,
          ban_duration: existingAuth.user.banned_until ? '876000h' : 'none',
        });
      }
      return NextResponse.json(
        { error: messageOf(profileError, 'No se pudo actualizar el perfil.') },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, emailChanged });
  } catch (error) {
    return NextResponse.json(
      { error: messageOf(error, 'No se pudo actualizar el usuario.') },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const actor = await requireAdmin(req);
  if (!actor) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });

  try {
    const { id } = await context.params;
    const body = await req.json();
    const action = body.action;

    if (action !== 'reset-access' && action !== 'resend-access') {
      return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: authData, error: readError } = await admin.auth.admin.getUserById(id);
    if (readError || !authData.user?.email) {
      return NextResponse.json({ error: 'No se encontró el usuario en Supabase Auth.' }, { status: 404 });
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', id)
      .maybeSingle();

    const fullName = profile?.full_name || authData.user.user_metadata?.full_name || 'Usuario';
    const password = temporaryPassword();

    const { error: updateError } = await admin.auth.admin.updateUserById(id, {
      password,
      ban_duration: 'none',
    });

    if (updateError) {
      return NextResponse.json(
        { error: messageOf(updateError, 'No se pudo generar el acceso temporal.') },
        { status: 400 }
      );
    }

    const { error: profileError } = await admin
      .from('profiles')
      .update({ must_change_password: true, active: true })
      .eq('id', id);

    if (profileError) {
      return NextResponse.json(
        { error: messageOf(profileError, 'Se cambió la contraseña, pero no se actualizó el perfil.') },
        { status: 400 }
      );
    }

    await sendAccessEmail(authData.user.email, fullName, password);

    return NextResponse.json({ ok: true, email: authData.user.email });
  } catch (error) {
    return NextResponse.json(
      { error: messageOf(error, 'No se pudo enviar el nuevo acceso.') },
      { status: 500 }
    );
  }
}
