// =============================================================================
// Agent-side database access (Supabase service role). Gracefully no-ops when
// Supabase isn't configured so the agent still runs for local voice testing.
// =============================================================================
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './config.js';

let client: SupabaseClient | null = null;

function db(): SupabaseClient | null {
  if (!config.hasSupabase) return null;
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export interface CallSnapshot {
  id: string;
  contactId: string | null;
}

/** Look up which campaign/agent profile a dialed tracking number maps to. */
export async function resolveTrackingNumber(phoneE164: string) {
  const c = db();
  if (!c) return null;
  const { data } = await c
    .from('tracking_numbers')
    .select('id, campaign_id, campaigns(id, name, agent_profile_id, discount_code, product_name)')
    .eq('phone_e164', phoneE164)
    .eq('active', true)
    .maybeSingle();
  return data;
}

/** Load the agent profile to use (specific id, or the default). */
export async function loadAgentProfile(id?: string | null) {
  const c = db();
  if (!c) return null;
  const q = c.from('agent_profiles').select('*');
  const { data } = id
    ? await q.eq('id', id).maybeSingle()
    : await q.eq('is_default', true).maybeSingle();
  return data;
}

/** Create the call row at the start of a call. Returns its id (or a local uuid). */
export async function createCall(opts: {
  livekitRoom: string;
  campaignId: string | null;
  agentProfileId: string | null;
  trackingNumberId: string | null;
  isTest: boolean;
}): Promise<string | null> {
  const c = db();
  if (!c) return null;
  const { data, error } = await c
    .from('calls')
    .insert({
      livekit_room: opts.livekitRoom,
      campaign_id: opts.campaignId,
      agent_profile_id: opts.agentProfileId,
      tracking_number_id: opts.trackingNumberId,
      outcome: 'in_progress',
      is_test: opts.isTest,
    })
    .select('id')
    .single();
  if (error) {
    console.error('[db] createCall failed', error);
    return null;
  }
  return data.id;
}

/** Upsert a contact by phone; returns contact id. */
export async function upsertContact(opts: {
  phoneE164: string | null;
  firstName?: string;
  lastName?: string;
  email?: string;
  campaignId?: string | null;
  isTest?: boolean;
}): Promise<string | null> {
  const c = db();
  if (!c) return null;

  // Try to find existing by phone.
  if (opts.phoneE164) {
    const { data: existing } = await c
      .from('contacts').select('id').eq('phone_e164', opts.phoneE164).maybeSingle();
    if (existing) return existing.id;
  }

  const { data, error } = await c
    .from('contacts')
    .insert({
      type: 'prospect',
      phone_e164: opts.phoneE164,
      first_name: opts.firstName,
      last_name: opts.lastName,
      email: opts.email,
      first_campaign_id: opts.campaignId ?? null,
    })
    .select('id')
    .single();
  if (error) {
    console.error('[db] upsertContact failed', error);
    return null;
  }
  return data.id;
}

/** Patch the contact with captured detail fields. */
export async function updateContact(contactId: string, patch: Record<string, unknown>) {
  const c = db();
  if (!c || !contactId) return;
  const { error } = await c.from('contacts').update(patch).eq('id', contactId);
  if (error) console.error('[db] updateContact failed', error);
}

/** Link a contact to the call. */
export async function linkCallContact(callId: string, contactId: string) {
  const c = db();
  if (!c || !callId) return;
  await c.from('calls').update({ contact_id: contactId }).eq('id', callId);
}

/** Update call progress / outcome. */
export async function updateCall(callId: string | null, patch: Record<string, unknown>) {
  const c = db();
  if (!c || !callId) return;
  const { error } = await c.from('calls').update(patch).eq('id', callId);
  if (error) console.error('[db] updateCall failed', error);
}

/** Record an order (front-end or back-end). NEVER pass card data here. */
export async function createOrder(opts: {
  contactId: string | null;
  callId: string | null;
  campaignId: string | null;
  kind: 'front_end' | 'back_end';
  tier?: string | null;
  status: 'pending' | 'paid' | 'declined' | 'test';
  amountCents: number;
  descriptor?: string;
  paymentToken?: string;
  declineReason?: string;
  isTest?: boolean;
}): Promise<string | null> {
  const c = db();
  if (!c) return null;
  const { data, error } = await c
    .from('orders')
    .insert({
      contact_id: opts.contactId,
      call_id: opts.callId,
      campaign_id: opts.campaignId,
      kind: opts.kind,
      tier: opts.tier ?? null,
      status: opts.status,
      amount_cents: opts.amountCents,
      descriptor: opts.descriptor,
      payment_token: opts.paymentToken,
      decline_reason: opts.declineReason,
      is_test: opts.isTest ?? false,
    })
    .select('id')
    .single();
  if (error) {
    console.error('[db] createOrder failed', error);
    return null;
  }
  return data.id;
}

/** Emit a trigger/automation event (card_declined, order_completed, ...). */
export async function emitEvent(opts: {
  contactId: string | null;
  callId?: string | null;
  orderId?: string | null;
  type: string;
  payload?: Record<string, unknown>;
}) {
  const c = db();
  if (!c) return;
  await c.from('events').insert({
    contact_id: opts.contactId,
    call_id: opts.callId ?? null,
    order_id: opts.orderId ?? null,
    type: opts.type,
    payload: opts.payload ?? {},
  });
}

/** Set or clear a flag on the contact (e.g. card_declined) for UI display. */
export async function setContactFlag(contactId: string | null, key: string, value: unknown) {
  const c = db();
  if (!c || !contactId) return;
  const { data } = await c.from('contacts').select('flags').eq('id', contactId).maybeSingle();
  const flags = (data?.flags as Record<string, unknown>) ?? {};
  flags[key] = value;
  await c.from('contacts').update({ flags }).eq('id', contactId);
}

/** Promote a contact to client when they buy. */
export async function markClient(contactId: string | null) {
  const c = db();
  if (!c || !contactId) return;
  await c.from('contacts').update({ type: 'client' }).eq('id', contactId);
}

export interface KnowledgeMatch {
  id: string;
  title: string;
  content: string;
  similarity: number;
}

/**
 * Semantic search over a profile's knowledge base (RAG). Calls the
 * match_knowledge() Postgres function with a query embedding. Returns [] when
 * Supabase isn't configured, there's no profile, or nothing matches.
 */
export async function searchKnowledge(
  profileId: string | null,
  queryEmbedding: number[],
  matchCount = 4,
): Promise<KnowledgeMatch[]> {
  const c = db();
  if (!c || !profileId || !queryEmbedding?.length) return [];
  const { data, error } = await c.rpc('match_knowledge', {
    query_embedding: queryEmbedding,
    profile_id: profileId,
    match_count: matchCount,
  });
  if (error) {
    console.error('[db] searchKnowledge failed', error);
    return [];
  }
  return (data ?? []) as KnowledgeMatch[];
}
