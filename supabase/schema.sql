-- =============================================================================
-- AI Inbound Voice Sales Agent — Database Schema
-- Market: US (FDA/FTC/DSHEA compliance)
-- Methodology: Caleb O'Dowd 10-step inbound close + KPI tracking
-- =============================================================================
-- Run this in the Supabase SQL editor (SQL Editor -> New query -> paste -> Run).
-- Safe to re-run: uses CREATE ... IF NOT EXISTS and idempotent enum guards.
-- =============================================================================

-- ---- Extensions ------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
-- pgvector: powers the RAG knowledge base (semantic search of agent knowledge).
create extension if not exists "vector";

-- ---- Enums -----------------------------------------------------------------
do $$ begin
  create type contact_type as enum ('prospect', 'client');
exception when duplicate_object then null; end $$;

do $$ begin
  -- Outcome of a call, mirrors Caleb's call-audit categories
  create type call_outcome as enum (
    'in_progress', 'sale', 'no_sale', 'callback', 'voicemail',
    'abandoned', 'transferred_human', 'error'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  -- Offer position on Caleb's value ladder
  create type offer_tier as enum ('platinum', 'gold', 'silver', 'bronze');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum (
    'pending', 'paid', 'declined', 'refunded', 'chargeback', 'test'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  -- back_end = the "+Plus" upsell / continuity; front_end = the core tier
  create type order_kind as enum ('front_end', 'back_end');
exception when duplicate_object then null; end $$;

-- =============================================================================
-- agent_profiles  — selectable personas (prompt + voice), edited in the UI
-- =============================================================================
create table if not exists agent_profiles (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,                       -- e.g. "Priya - warm closer"
  -- The full editable system prompt typed in the website UI (Step 2 requirement).
  system_prompt   text not null default '',
  -- Gemini Live voice id (any of the 30 named voices, e.g. 'Puck', 'Kore', 'Zephyr').
  voice           text not null default 'Puck',
  -- Gemini 3.1 thinking level: 'minimal' (no thinking) | 'low' | 'medium' | 'high'.
  thinking_level  text not null default 'low',
  -- Opening line incl. consent + bot disclosure (configurable per market/state).
  greeting        text not null default '',
  -- Verbatim FAQ knowledge base the agent must not deviate from (JSON array of {q,a}).
  faq             jsonb not null default '[]'::jsonb,
  -- Compliance ruleset name to apply, e.g. 'us_dshea'.
  compliance_ruleset text not null default 'us_dshea',
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- =============================================================================
-- offers  — the Gold/Silver/Bronze ladder + the "+Plus" upsell, per campaign
-- =============================================================================
create table if not exists offers (
  id            uuid primary key default uuid_generate_v4(),
  campaign_id   uuid,                                  -- FK added after campaigns
  tier          offer_tier not null,
  kind          order_kind not null default 'front_end',
  name          text not null,                         -- "6-month Platinum supply"
  bottles       int,
  price_cents   int not null,                          -- store money as integer cents
  shipping_cents int not null default 0,
  currency      text not null default 'USD',
  bonuses       jsonb not null default '[]'::jsonb,    -- free reports etc.
  sort_order    int not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- =============================================================================
-- campaigns  — one per newspaper ad/appeal being tested
-- =============================================================================
create table if not exists campaigns (
  id               uuid primary key default uuid_generate_v4(),
  name             text not null,                      -- "Joint pain - Miami Herald"
  agent_profile_id uuid references agent_profiles(id) on delete set null,
  -- The printed discount/approval code the caller reads from the ad.
  discount_code    text,
  -- Newspaper circulation for calls-per-thousand (CPT) metric.
  circulation      int,
  ad_cost_cents    int not null default 0,             -- for MER = sales / ad cost
  product_name     text not null default '',
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Wire offers.campaign_id now that campaigns exists.
do $$ begin
  alter table offers
    add constraint offers_campaign_fk
    foreign key (campaign_id) references campaigns(id) on delete cascade;
exception when duplicate_object then null; end $$;

-- =============================================================================
-- tracking_numbers  — unique inbound number per ad (Caleb: number, NOT a code)
-- =============================================================================
create table if not exists tracking_numbers (
  id           uuid primary key default uuid_generate_v4(),
  phone_e164   text not null unique,                   -- "+18885551234"
  campaign_id  uuid references campaigns(id) on delete set null,
  label        text,                                   -- "Miami Herald wk23"
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- =============================================================================
-- contacts  — every caller, buyer or not (prospect file vs client file)
-- =============================================================================
create table if not exists contacts (
  id            uuid primary key default uuid_generate_v4(),
  type          contact_type not null default 'prospect',
  first_name    text,
  last_name     text,
  email         text,
  phone_e164    text,
  address_line1 text,
  address_line2 text,
  city          text,
  state         text,
  postal_code   text,
  country       text default 'US',
  -- The specific health fear probed in Step 2 — reused by the objection handler.
  probed_fear   text,
  -- Free-form tags for segmentation/remarketing.
  tags          text[] not null default '{}',
  -- Surfaced in the UI: e.g. "card_declined" flag lives here for quick display.
  flags         jsonb not null default '{}'::jsonb,
  notes         text,
  first_campaign_id uuid references campaigns(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists contacts_phone_idx on contacts (phone_e164);
create index if not exists contacts_type_idx  on contacts (type);

-- =============================================================================
-- calls  — one row per inbound call, with audit fields for Caleb's KPIs
-- =============================================================================
create table if not exists calls (
  id                uuid primary key default uuid_generate_v4(),
  contact_id        uuid references contacts(id) on delete set null,
  campaign_id       uuid references campaigns(id) on delete set null,
  agent_profile_id  uuid references agent_profiles(id) on delete set null,
  tracking_number_id uuid references tracking_numbers(id) on delete set null,
  -- LiveKit room / Telnyx call identifiers for correlation.
  livekit_room      text,
  telnyx_call_id    text,
  direction         text not null default 'inbound',
  outcome           call_outcome not null default 'in_progress',
  -- Which Caleb step the call reached (1..10) — for funnel analysis.
  reached_step      int,
  duration_seconds  int,
  -- Storage path of the recording (card-capture leg masked/paused).
  recording_url     text,
  transcript        jsonb not null default '[]'::jsonb,  -- [{role, text, ts}]
  -- Discount/approval code the caller gave from the ad.
  discount_code     text,
  is_test           boolean not null default false,       -- exclude test calls from KPIs
  started_at        timestamptz not null default now(),
  ended_at          timestamptz
);
create index if not exists calls_campaign_idx on calls (campaign_id);
create index if not exists calls_outcome_idx  on calls (outcome);
create index if not exists calls_started_idx  on calls (started_at);

-- =============================================================================
-- orders  — front-end (core tier) and back-end (+Plus / continuity) sales
--           NOTE: NO card data is ever stored here (PCI out-of-scope).
-- =============================================================================
create table if not exists orders (
  id              uuid primary key default uuid_generate_v4(),
  contact_id      uuid references contacts(id) on delete set null,
  call_id         uuid references calls(id) on delete set null,
  campaign_id     uuid references campaigns(id) on delete set null,
  offer_id        uuid references offers(id) on delete set null,
  kind            order_kind not null default 'front_end',
  tier            offer_tier,
  status          order_status not null default 'pending',
  amount_cents    int not null default 0,
  currency        text not null default 'USD',
  -- Payment processor token/ref ONLY — never the PAN/CVV.
  payment_token   text,
  processor       text default 'authorize_net_sandbox',
  decline_reason  text,
  -- Statement descriptor read back to caller (chargeback defense, Step 9).
  descriptor      text,
  items           jsonb not null default '[]'::jsonb,
  is_test         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists orders_contact_idx  on orders (contact_id);
create index if not exists orders_status_idx   on orders (status);
create index if not exists orders_campaign_idx on orders (campaign_id);

-- =============================================================================
-- events  — trigger/automation log (card_declined, order_completed, etc.)
--           Step 4 requirement: drives UI flags + downstream webhooks/SMS/email.
-- =============================================================================
create table if not exists events (
  id          uuid primary key default uuid_generate_v4(),
  contact_id  uuid references contacts(id) on delete cascade,
  call_id     uuid references calls(id) on delete set null,
  order_id    uuid references orders(id) on delete set null,
  type        text not null,            -- 'card_declined' | 'order_completed' | ...
  payload     jsonb not null default '{}'::jsonb,
  -- Whether downstream automations (webhook/SMS/email) have fired.
  processed   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists events_type_idx      on events (type);
create index if not exists events_contact_idx   on events (contact_id);
create index if not exists events_processed_idx on events (processed) where processed = false;

-- =============================================================================
-- updated_at touch trigger
-- =============================================================================
create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

do $$ begin
  create trigger trg_contacts_touch before update on contacts
    for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger trg_campaigns_touch before update on campaigns
    for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger trg_orders_touch before update on orders
    for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger trg_agent_profiles_touch before update on agent_profiles
    for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;

-- =============================================================================
-- Seed: one default agent profile so the system runs out of the box.
-- =============================================================================
insert into agent_profiles (name, voice, is_default, greeting, system_prompt)
select 'Global Default', 'Puck', true,
  'Thanks for calling. This call may be recorded for quality, and you are speaking with an automated assistant. Who do I have the pleasure of speaking with today?',
  'You are a warm, professional inbound sales agent. Follow the 10-step process. Never make disease/cure claims.'
where not exists (select 1 from agent_profiles where is_default = true);

-- =============================================================================
-- knowledge_documents — RAG knowledge base (pgvector). Each row is one chunk of
-- source text plus its embedding. Scoped per agent profile so different personas
-- can have different knowledge. The agent embeds the caller's question at runtime
-- and retrieves the closest chunks via match_knowledge() below.
--
-- Embeddings: Google gemini-embedding-001 @ 768 dims (set outputDimensionality
-- to 768 when embedding). If you change the dimension, change vector(768) too.
-- =============================================================================
create table if not exists knowledge_documents (
  id               uuid primary key default uuid_generate_v4(),
  agent_profile_id uuid references agent_profiles(id) on delete cascade,
  -- Groups all chunks that came from one ingested document (one paste), so the
  -- UI can list/delete a document as a unit.
  source_id        uuid not null default uuid_generate_v4(),
  -- A human label for the source (e.g. "Ingredient sheet", "Return policy").
  title            text not null default '',
  -- The chunk text the agent will read back from.
  content          text not null,
  -- Ordering within a source document, for stable display/dedup.
  chunk_index      int not null default 0,
  embedding        vector(768),
  created_at       timestamptz not null default now()
);
create index if not exists knowledge_profile_idx on knowledge_documents (agent_profile_id);
create index if not exists knowledge_source_idx on knowledge_documents (source_id);
-- IVFFlat cosine index for fast approximate nearest-neighbour search.
create index if not exists knowledge_embedding_idx
  on knowledge_documents using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Retrieve the top-k most similar knowledge chunks for a profile.
-- Returns similarity in [0,1] (1 = identical direction). The agent passes a
-- query embedding generated with task type RETRIEVAL_QUERY.
create or replace function match_knowledge(
  query_embedding vector(768),
  profile_id uuid,
  match_count int default 4,
  min_similarity float default 0.3
)
returns table (id uuid, title text, content text, similarity float)
language sql stable
as $$
  select
    k.id,
    k.title,
    k.content,
    1 - (k.embedding <=> query_embedding) as similarity
  from knowledge_documents k
  where k.agent_profile_id = profile_id
    and k.embedding is not null
    and 1 - (k.embedding <=> query_embedding) >= min_similarity
  order by k.embedding <=> query_embedding
  limit match_count
$$;

