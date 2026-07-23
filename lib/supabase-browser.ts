import { createClient } from '@supabase/supabase-js';

let client: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowser() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Faltan las variables públicas de Supabase.');
  client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}
