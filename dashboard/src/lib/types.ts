// =============================================================================
// Shared domain types — mirror supabase/schema.sql
// =============================================================================

export type ContactType = 'prospect' | 'client';

export type CallOutcome =
  | 'in_progress' | 'sale' | 'no_sale' | 'callback'
  | 'voicemail' | 'abandoned' | 'transferred_human' | 'error';

export type OfferTier = 'platinum' | 'gold' | 'silver' | 'bronze';

export type OrderStatus =
  | 'pending' | 'paid' | 'declined' | 'refunded' | 'chargeback' | 'test';

export type OrderKind = 'front_end' | 'back_end';

export interface FaqItem {
  q: string;
  a: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  system_prompt: string;
  voice: string;
  greeting: string;
  faq: FaqItem[];
  compliance_ruleset: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Offer {
  id: string;
  campaign_id: string | null;
  tier: OfferTier;
  kind: OrderKind;
  name: string;
  bottles: number | null;
  price_cents: number;
  shipping_cents: number;
  currency: string;
  bonuses: unknown[];
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  agent_profile_id: string | null;
  discount_code: string | null;
  circulation: number | null;
  ad_cost_cents: number;
  product_name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrackingNumber {
  id: string;
  phone_e164: string;
  campaign_id: string | null;
  label: string | null;
  active: boolean;
  created_at: string;
}

export interface Contact {
  id: string;
  type: ContactType;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_e164: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  probed_fear: string | null;
  tags: string[];
  flags: Record<string, unknown>;
  notes: string | null;
  first_campaign_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TranscriptTurn {
  role: 'agent' | 'caller' | 'system';
  text: string;
  ts: string;
}

export interface Call {
  id: string;
  contact_id: string | null;
  campaign_id: string | null;
  agent_profile_id: string | null;
  tracking_number_id: string | null;
  livekit_room: string | null;
  telnyx_call_id: string | null;
  direction: string;
  outcome: CallOutcome;
  reached_step: number | null;
  duration_seconds: number | null;
  recording_url: string | null;
  transcript: TranscriptTurn[];
  discount_code: string | null;
  is_test: boolean;
  started_at: string;
  ended_at: string | null;
}

export interface Order {
  id: string;
  contact_id: string | null;
  call_id: string | null;
  campaign_id: string | null;
  offer_id: string | null;
  kind: OrderKind;
  tier: OfferTier | null;
  status: OrderStatus;
  amount_cents: number;
  currency: string;
  payment_token: string | null;
  processor: string | null;
  decline_reason: string | null;
  descriptor: string | null;
  items: unknown[];
  is_test: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventRow {
  id: string;
  contact_id: string | null;
  call_id: string | null;
  order_id: string | null;
  type: string;
  payload: Record<string, unknown>;
  processed: boolean;
  created_at: string;
}
