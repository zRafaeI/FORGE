import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Supabase está configurado quando URL e chave pública existem no ambiente. */
export const supabaseConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

/** Cliente único no navegador. Só a chave pública (publishable/anon) é usada. */
export function getSupabase(): SupabaseClient {
  if (!url || !key) throw new Error("Supabase não configurado.");
  client ??= createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
  });
  return client;
}
