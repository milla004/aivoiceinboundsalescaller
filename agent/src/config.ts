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
  livekitApiKey: opt('LIVEKIT_API_KEY'),
  livekitApiSecret: opt('LIVEKIT_API_SECRET'),

  // Call recording via LiveKit Egress -> your own S3/GCS bucket.
  // GCS works via the S3-compatible endpoint. Recording is skipped if unset.
  egress: {
    bucket: opt('EGRESS_S3_BUCKET'),
    region: opt('EGRESS_S3_REGION'),
    accessKey: opt('EGRESS_S3_ACCESS_KEY'),
    secret: opt('EGRESS_S3_SECRET'),
    endpoint: opt('EGRESS_S3_ENDPOINT'), // optional (e.g. GCS: storage.googleapis.com)
  },

  // Payment mode — sandbox until a real MOTO merchant account + bank exist.
  paymentMode: opt('PAYMENT_MODE', 'sandbox'),

  get hasSupabase() {
    return Boolean(this.supabaseUrl && this.supabaseServiceKey);
  },

  get hasEgress() {
    return Boolean(
      this.egress.bucket && this.egress.accessKey && this.egress.secret && this.livekitUrl,
    );
  },
};

export { req };
