// =============================================================================
// Agent config — loaded from environment.
// =============================================================================
import 'dotenv/config';

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function opt(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const config = {
  // Supabase (service role — agent is a trusted backend process)
  supabaseUrl: opt('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseServiceKey: opt('SUPABASE_SERVICE_ROLE_KEY'),

  // Gemini Live
  googleApiKey: opt('GOOGLE_API_KEY'),
  geminiModel: opt('GEMINI_MODEL', 'gemini-2.0-flash-live-001'),

  // LiveKit (read by the SDK from env too, but kept here for clarity)
  livekitUrl: opt('LIVEKIT_URL'),

  // Payment mode — sandbox until a real MOTO merchant account + bank exist.
  paymentMode: opt('PAYMENT_MODE', 'sandbox'),

  get hasSupabase() {
    return Boolean(this.supabaseUrl && this.supabaseServiceKey);
  },
};

export { req };
