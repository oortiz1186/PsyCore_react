import { createClient } from '@supabase/supabase-js';

// El proyecto todavía no cuenta con tipos generados completos de Supabase.
// Hasta que se genere `database.types.ts`, el cliente se mantiene sin tipado
// estricto para evitar que `from().insert/update()` infiera `never` y que los
// RPC personalizados rechacen sus argumentos durante el build.
type BrowserSupabaseClient = ReturnType<typeof createClient<any>>;

let client: BrowserSupabaseClient | null = null;

export function getSupabaseBrowser(): BrowserSupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Faltan las variables públicas de Supabase.');
  }

  client = createClient<any>(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
      storageKey: 'psycore-auth-session',
    },
  });

  return client;
}
