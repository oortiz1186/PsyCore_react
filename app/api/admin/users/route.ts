import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSmtpSettings } from '@/lib/smtp-settings';

const ALLOWED_ROLES = ['Administrador', 'Asistente', 'Psicóloga', 'Recepcionista'];
const OPAQUE_MESSAGES = new Set(['{}', '[object Object]', 'null', 'undefined']);

function errorMessage(error: unknown, fallback = 'Ocurrió un error inesperado.') {
  if (error instanceof Error && error.message && !OPAQUE_MESSAGES.has(error.message.trim())) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim() && !OPAQUE_MESSAGES.has(error.trim())) {
    return error;
  }

  if (error && typeof error === 'object') {
    const candidate = error as {
      message?: unknown;
      error_description?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
      status?: unknown;
    };

    for (const value of [
      candidate.message,
      candidate.error_description,
      candidate.details,
      candidate.hint,
    ]) {
      if (
        typeof value === 'string' &&
        value.trim() &&
        !OPAQUE_MESSAGES.has(value.trim())
      ) {
        return value;
      }
    }

    if (typeof candidate.code === 'string' && candidate.code.trim()) {
      return `Error de Supabase (${candidate.code}).`;
    }
  }

  return fallback;
}

function friendlyAuthError(error: unknown) {
  const message = errorMessage(
    error,
    'Supabase rechazó la creación del usuario. Revisa en Authentication > Logs si existe un trigger antiguo o una restricción de la base de datos.'
  );
  const normalized = message.toLowerCase();

  if (
    normalized.includes('already been registered') ||
    normalized.includes('already registered') ||
    normalized.includes('user already exists') ||
    normalized.includes('email address is already')
  ) {
    return 'Ya existe un usuario registrado con ese correo electrónico.';
  }

  if (normalized.includes('invalid email')) {
    return 'El correo electrónico no tiene un formato válido.';
  }

  if (normalized.includes('database error creating new user')) {
    return 'Supabase no pudo crear el usuario por una regla o trigger de la base de datos. Revisa y elimina el trigger antiguo relacionado con pending_users antes de volver a intentarlo.';
  }

  if (normalized.includes('password')) {
    return 'No fue posible generar una contraseña temporal válida.';
  }

  return message;
}

async function authorize(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;

  const admin = getSupabaseAdmin();
  const { data } = await admin.auth.getUser(token);
  if (!data.user) return null;

  const { data: profile } = await admin
    .from('profiles')
    .select('role_id,roles(name)')
    .eq('id', data.user.id)
    .maybeSingle();

  const role = Array.isArray(profile?.roles)
    ? profile.roles[0]?.name
    : (profile?.roles as { name?: string } | null)?.name;

  return role === 'Administrador' ? data.user : null;
}

function tempPassword() {
  return `Psy-${crypto.randomBytes(6).toString('base64url')}!9`;
}

async function authUserExists(email: string) {
  const admin = getSupabaseAdmin();
  let page = 1;

  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) {
      console.warn('Could not pre-check existing auth users:', error);
      return false;
    }

    if (data.users.some((user) => user.email?.toLowerCase() === email)) return true;
    if (data.users.length < 100) return false;
    page += 1;
  }

  return false;
}

export async function POST(req: NextRequest) {
  try {
    const actor = await authorize(req);
    if (!actor) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    const body = await req.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const roleId = Number(body.roleId);

    if (!email || !fullName || !Number.isInteger(roleId) || roleId <= 0) {
      return NextResponse.json(
        { error: 'Nombre, correo y rol son obligatorios.' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();
    const { data: role, error: roleError } = await admin
      .from('roles')
      .select('id,name')
      .eq('id', roleId)
      .maybeSingle();

    if (roleError) {
      return NextResponse.json(
        { error: errorMessage(roleError, 'No se pudo validar el rol seleccionado.') },
        { status: 400 }
      );
    }

    if (!role || !ALLOWED_ROLES.includes(role.name)) {
      return NextResponse.json(
        { error: 'El rol seleccionado no está permitido.' },
        { status: 400 }
      );
    }

    if (await authUserExists(email)) {
      return NextResponse.json(
        { error: 'Ya existe un usuario registrado con ese correo electrónico.' },
        { status: 409 }
      );
    }

    const password = tempPassword();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (error || !data.user) {
      console.error('Error creating PsyCore auth user:', error);
      return NextResponse.json(
        { error: friendlyAuthError(error) },
        { status: 400 }
      );
    }

    const userId = data.user.id;
    const { error: profileError } = await admin.from('profiles').upsert({
      id: userId,
      full_name: fullName,
      email,
      role_id: roleId,
      active: true,
      must_change_password: true,
    });

    if (profileError) {
      console.error('Error creating PsyCore profile:', profileError);
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        {
          error: errorMessage(
            profileError,
            'No se pudo crear el perfil del usuario. El acceso fue revertido.'
          ),
        },
        { status: 400 }
      );
    }

    let passwordSent = false;
    let emailWarning = '';

    try {
      const smtp = await getSmtpSettings();

      if (smtp) {
        const transport = nodemailer.createTransport({
          host: smtp.host,
          port: smtp.port,
          secure: smtp.secure,
          auth: { user: smtp.username, pass: smtp.password },
        });

        await transport.sendMail({
          from: `${smtp.fromName} <${smtp.fromEmail}>`,
          to: email,
          subject: 'Tu acceso a PsyCore',
          html: `<h2>Bienvenida/o a PsyCore</h2><p>Tu cuenta ha sido creada.</p><p><strong>Correo:</strong> ${email}</p><p><strong>Contraseña temporal:</strong> ${password}</p><p><a href="${smtp.appUrl}/login">Ingresar a PsyCore</a></p><p>Al iniciar sesión deberás cambiar la contraseña.</p>`,
        });

        passwordSent = true;
      } else {
        emailWarning = 'El usuario se creó, pero todavía no existe configuración SMTP.';
      }
    } catch (mailError) {
      console.error('Error sending PsyCore access email:', mailError);
      emailWarning = `El usuario se creó, pero no se pudo enviar el correo: ${errorMessage(
        mailError,
        'error SMTP desconocido'
      )}`;
    }

    return NextResponse.json({
      id: userId,
      email,
      passwordSent,
      emailWarning,
    });
  } catch (error) {
    console.error('Unexpected user creation error:', error);
    return NextResponse.json(
      { error: errorMessage(error, 'Error inesperado al crear el usuario.') },
      { status: 500 }
    );
  }
}
