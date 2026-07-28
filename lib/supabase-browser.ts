import { createClient } from '@supabase/supabase-js';

type SupabaseRpcResponse = PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}>;

type BrowserSupabaseClient = Omit<ReturnType<typeof createClient>, 'rpc'> & {
  rpc(functionName: string, args?: Record<string, unknown>): SupabaseRpcResponse;
};

let client: BrowserSupabaseClient | null = null;

export function getSupabaseBrowser(): BrowserSupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Faltan las variables públicas de Supabase.');
  }

  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
      storageKey: 'psycore-auth-session',
    },
  }) as BrowserSupabaseClient;

  return client;
}
