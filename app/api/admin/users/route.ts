import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSmtpSettings } from '@/lib/smtp-settings';

const ALLOWED_ROLES = ['Administrador', 'Asistente', 'Psicóloga', 'Recepcionista'];

function errorMessage(error: unknown, fallback = 'Ocurrió un error inesperado.') {
  if (error instanceof Error && error.message && error.message !== '{}') return error.message;
  if (typeof error === 'string' && error.trim() && error.trim() !== '{}') return error;
  if (error && typeof error === 'object') {
    const value = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    for (const item of [value.message, value.details, value.hint]) {
      if (typeof item === 'string' && item.trim() && item.trim() !== '{}') return item;
    }
    if (typeof value.code === 'string') return `Error de Supabase (${value.code}).`;
  }
  return fallback;
}

function roleNameOf(value: unknown): string | undefined {
  const role = Array.isArray(value) ? value[0] : value;
  if (!role || typeof role !== 'object' || !('name' in role)) return undefined;
  return typeof role.name === 'string' ? role.name : undefined;
}

async function authorize(req: NextRequest) {
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

function tempPassword() {
  return `Psy-${crypto.randomBytes(8).toString('base64url')}!9`;
}

async function listAllAuthUsers() {
  const admin = getSupabaseAdmin();
  const users = [] as Awaited<ReturnType<typeof admin.auth.admin.listUsers>>['data']['users'];
  let page = 1;
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 100) break;
    page += 1;
  }
  return users;
}

export async function GET(req: NextRequest) {
  const actor = await authorize(req);
  if (!actor) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });

  try {
    const admin = getSupabaseAdmin();
    const [{ data: profiles, error }, authUsers] = await Promise.all([
      admin
        .from('profiles')
        .select('id,full_name,email,role_id,active,created_at,created_by,psychologist_id,roles(id,name)')
        .order('created_at', { ascending: false }),
      listAllAuthUsers(),
    ]);

    if (error) throw error;

    const relatedIds = [...new Set((profiles || []).flatMap((p) => [p.created_by, p.psychologist_id]).filter(Boolean))];
    const { data: relatedProfiles } = relatedIds.length
      ? await admin.from('profiles').select('id,full_name,email').in('id', relatedIds)
      : { data: [] as { id: string; full_name: string | null; email: string | null }[] };

    const relatedMap = new Map((relatedProfiles || []).map((item) => [item.id, item]));
    const authMap = new Map(authUsers.map((user) => [user.id, user]));

    const users = (profiles || []).map((profile) => {
      const authUser = authMap.get(profile.id);
      const creator = profile.created_by ? relatedMap.get(profile.created_by) : null;
      const psychologist = profile.psychologist_id ? relatedMap.get(profile.psychologist_id) : null;
      return {
        ...profile,
        last_sign_in_at: authUser?.last_sign_in_at || null,
        auth_created_at: authUser?.created_at || null,
        creator_name: creator?.full_name || creator?.email || null,
        psychologist_name: psychologist?.full_name || psychologist?.email || null,
      };
    });

    return NextResponse.json({ users });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'No se pudieron cargar los usuarios.') },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await authorize(req);
    if (!actor) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });

    const body = await req.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const roleId = Number(body.roleId);
    const requestedPsychologistId = typeof body.psychologistId === 'string' && body.psychologistId
      ? body.psychologistId
      : null;

    if (!email || !fullName || !Number.isInteger(roleId) || roleId <= 0) {
      return NextResponse.json({ error: 'Nombre, correo y rol son obligatorios.' }, { status: 400 });
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

    if (role.name === 'Asistente') {
      if (!requestedPsychologistId) {
        return NextResponse.json(
          { error: 'Debes seleccionar la psicóloga responsable de la asistente.' },
          { status: 400 }
        );
      }

      const { data: psychologist, error: psychologistError } = await admin
        .from('profiles')
        .select('id,roles(name)')
        .eq('id', requestedPsychologistId)
        .maybeSingle();
      const psychologistRole = roleNameOf(psychologist?.roles);

      if (psychologistError || !psychologist || psychologistRole !== 'Psicóloga') {
        return NextResponse.json(
          { error: 'La psicóloga seleccionada no es válida.' },
          { status: 400 }
        );
      }
    }

    const existingUsers = await listAllAuthUsers();
    if (existingUsers.some((user) => user.email?.toLowerCase() === email)) {
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
      return NextResponse.json(
        { error: errorMessage(error, 'Supabase rechazó la creación del usuario.') },
        { status: 400 }
      );
    }

    const userId = data.user.id;
    const psychologistId = role.name === 'Psicóloga'
      ? userId
      : role.name === 'Asistente'
        ? requestedPsychologistId
        : null;

    const { error: profileError } = await admin.from('profiles').upsert({
      id: userId,
      full_name: fullName,
      email,
      role_id: roleId,
      active: true,
      must_change_password: true,
      created_by: actor.id,
      psychologist_id: psychologistId,
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: errorMessage(profileError, 'No se pudo crear el perfil del usuario.') },
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
          html: `<h2>Bienvenida/o a PsyCore</h2><p>Tu cuenta ha sido creada.</p><p><strong>Correo:</strong> ${email}</p><p><strong>Contraseña temporal:</strong> ${password}</p><p><strong>Rol:</strong> ${role.name}</p><p><a href="${smtp.appUrl}/login">Ingresar a PsyCore</a></p><p>Al iniciar sesión deberás cambiar la contraseña.</p>`,
        });
        passwordSent = true;
      } else {
        emailWarning = 'El usuario se creó, pero todavía no existe configuración SMTP.';
      }
    } catch (mailError) {
      emailWarning = `El usuario se creó, pero no se pudo enviar el correo: ${errorMessage(
        mailError,
        'error SMTP desconocido'
      )}`;
    }

    return NextResponse.json({ id: userId, email, passwordSent, emailWarning });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Error inesperado al crear el usuario.') },
      { status: 500 }
    );
  }
}
