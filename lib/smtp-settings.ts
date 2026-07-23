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
  const secret = process.env.SMTP_ENCRYPTION_KEY;
  if (!secret) throw new Error('Falta SMTP_ENCRYPTION_KEY en .env.local.');
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
  const [ivValue, tagValue, encryptedValue] = value.split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export async function getSmtpSettings(): Promise<SmtpSettings | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('smtp_settings')
    .select('*')
    .eq('id', SETTINGS_ID)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    host: data.host,
    port: data.port,
    secure: data.secure,
    username: data.username,
    password: decrypt(data.password_encrypted),
    fromEmail: data.from_email,
    fromName: data.from_name,
    appUrl: data.app_url,
  };
}

export async function saveSmtpSettings(settings: SmtpSettings) {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from('smtp_settings').upsert({
    id: SETTINGS_ID,
    host: settings.host.trim(),
    port: settings.port,
    secure: settings.secure,
    username: settings.username.trim(),
    password_encrypted: encrypt(settings.password),
    from_email: settings.fromEmail.trim().toLowerCase(),
    from_name: settings.fromName.trim(),
    app_url: settings.appUrl.trim(),
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}
