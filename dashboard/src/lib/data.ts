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
