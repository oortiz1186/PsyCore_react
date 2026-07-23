import crypto from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export type SmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  appUrl: string;
};

const SETTINGS_ID = 1;

function encryptionKey() {
  const secret = process.env.SMTP_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error(
      'Falta SUPABASE_SERVICE_ROLE_KEY en .env.local. Esta clave es necesaria para proteger la contraseña SMTP.'
    );
  }

  return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

function decrypt(value: string) {
  const parts = value.split('.');

  if (parts.length !== 3) {
    throw new Error('La contraseña SMTP guardada tiene un formato inválido. Captúrala y guarda nuevamente.');
  }

  const [ivValue, tagValue, encryptedValue] = parts;
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(ivValue, 'base64')
  );

  decipher.setAuthTag(Buffer.from(tagValue, 'base64'));

  try {
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new Error(
      'No fue posible descifrar la contraseña SMTP. Vuelve a escribirla y guarda la configuración.'
    );
  }
}

function databaseError(error: { code?: string; message?: string }) {
  if (error.code === '42P01' || error.message?.includes('smtp_settings')) {
    return new Error(
      'No existe la tabla smtp_settings. Ejecuta la migración supabase/migrations/20260722_smtp_settings.sql en Supabase SQL Editor.'
    );
  }

  return new Error(error.message || 'Error al consultar la configuración SMTP.');
}

export async function getSmtpSettings(): Promise<SmtpSettings | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('smtp_settings')
    .select('*')
    .eq('id', SETTINGS_ID)
    .maybeSingle();

  if (error) throw databaseError(error);
  if (!data) return null;

  return {
    host: data.host,
    port: Number(data.port),
    secure: Boolean(data.secure),
    username: data.username,
    password: decrypt(data.password_encrypted),
    fromEmail: data.from_email,
    fromName: data.from_name,
    appUrl: data.app_url,
  };
}

export async function saveSmtpSettings(settings: SmtpSettings) {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from('smtp_settings').upsert(
    {
      id: SETTINGS_ID,
      host: settings.host.trim(),
      port: settings.port,
      secure: settings.secure,
      username: settings.username.trim(),
      password_encrypted: encrypt(settings.password),
      from_email: settings.fromEmail.trim().toLowerCase(),
      from_name: settings.fromName.trim() || 'PsyCore',
      app_url: settings.appUrl.trim() || 'http://localhost:3000',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (error) throw databaseError(error);
}