// =============================================================================
// Supabase clients
//  - browserClient(): for client components (anon key, RLS-aware)
//  - serviceClient(): SERVER ONLY (service role key, bypasses RLS) — never import
//    this into a client component.
// =============================================================================
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _service: SupabaseClient | null = null;

/** Server-only client with the service role key. Use in route handlers / server actions. */
export function serviceClient(): SupabaseClient {
  if (_service) return _service;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env.local.'
    );
  }
  _service = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _service;
}

/** Browser client with the anon key. Safe for client components. */
export function browserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
  return createClient(url, key);
}
