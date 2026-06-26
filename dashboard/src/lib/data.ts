// =============================================================================
// Server-side data access. Every function tolerates a missing/unconfigured
// Supabase (returns empty data) so the dashboard renders before keys are added.
// =============================================================================
import { serviceClient } from './supabase';
import type { Call, Campaign, Contact, Order, AgentProfile, EventRow } from './types';

export function isConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!isConfigured()) return fallback;
  try {
    return await fn();
  } catch (e) {
    console.error('[data] query failed:', e);
    return fallback;
  }
}

export function getCalls(limit = 200): Promise<Call[]> {
  return safe(async () => {
    const { data, error } = await serviceClient()
      .from('calls').select('*').order('started_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []) as Call[];
  }, []);
}

export interface CallFilters {
  /** ISO date (inclusive) lower bound on started_at. */
  from?: string | null;
  /** ISO date (inclusive) upper bound on started_at. */
  to?: string | null;
  campaignId?: string | null;
  /** Filter by discount/tracking code (exact match). */
  code?: string | null;
  limit?: number;
}

/** Calls filtered by date range / campaign / code, newest first. */
export function getCallsFiltered(filters: CallFilters = {}): Promise<Call[]> {
  return safe(async () => {
    let q = serviceClient().from('calls').select('*');
    if (filters.from) q = q.gte('started_at', filters.from);
    if (filters.to) {
      // Make the upper bound inclusive of the whole day.
      q = q.lte('started_at', `${filters.to}T23:59:59.999Z`);
    }
    if (filters.campaignId) q = q.eq('campaign_id', filters.campaignId);
    if (filters.code) q = q.eq('discount_code', filters.code);
    const { data, error } = await q
      .order('started_at', { ascending: false })
      .limit(filters.limit ?? 500);
    if (error) throw error;
    return (data ?? []) as Call[];
  }, []);
}

/** Orders filtered by date range / campaign, newest first. */
export function getOrdersFiltered(filters: CallFilters = {}): Promise<Order[]> {
  return safe(async () => {
    let q = serviceClient().from('orders').select('*');
    if (filters.from) q = q.gte('created_at', filters.from);
    if (filters.to) q = q.lte('created_at', `${filters.to}T23:59:59.999Z`);
    if (filters.campaignId) q = q.eq('campaign_id', filters.campaignId);
    const { data, error } = await q
      .order('created_at', { ascending: false })
      .limit(filters.limit ?? 2000);
    if (error) throw error;
    return (data ?? []) as Order[];
  }, []);
}

export function getCall(id: string): Promise<Call | null> {
  return safe(async () => {
    const { data, error } = await serviceClient()
      .from('calls').select('*').eq('id', id).single();
    if (error) throw error;
    return data as Call;
  }, null);
}

export function getOrders(limit = 500): Promise<Order[]> {
  return safe(async () => {
    const { data, error } = await serviceClient()
      .from('orders').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []) as Order[];
  }, []);
}

export function getCampaigns(): Promise<Campaign[]> {
  return safe(async () => {
    const { data, error } = await serviceClient()
      .from('campaigns').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Campaign[];
  }, []);
}

export function getContacts(limit = 500): Promise<Contact[]> {
  return safe(async () => {
    const { data, error } = await serviceClient()
      .from('contacts').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []) as Contact[];
  }, []);
}

export function getContact(id: string): Promise<Contact | null> {
  return safe(async () => {
    const { data, error } = await serviceClient()
      .from('contacts').select('*').eq('id', id).single();
    if (error) throw error;
    return data as Contact;
  }, null);
}

export function getAgentProfiles(): Promise<AgentProfile[]> {
  return safe(async () => {
    const { data, error } = await serviceClient()
      .from('agent_profiles').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as AgentProfile[];
  }, []);
}

export function getAgentProfile(id: string): Promise<AgentProfile | null> {
  return safe(async () => {
    const { data, error } = await serviceClient()
      .from('agent_profiles').select('*').eq('id', id).single();
    if (error) throw error;
    return data as AgentProfile;
  }, null);
}

export function getEventsForContact(contactId: string): Promise<EventRow[]> {
  return safe(async () => {
    const { data, error } = await serviceClient()
      .from('events').select('*').eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as EventRow[];
  }, []);
}

export function getOrdersForContact(contactId: string): Promise<Order[]> {
  return safe(async () => {
    const { data, error } = await serviceClient()
      .from('orders').select('*').eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Order[];
  }, []);
}
