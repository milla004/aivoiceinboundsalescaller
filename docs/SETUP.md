# Setup & Key Collection Guide

Collect these five sets of credentials, put them in `dashboard/.env.local` and
`agent/.env` (same values, both files), then run the database schema. Nothing
here charges real money — payment stays in sandbox.

---

## 1. Supabase (database + call recordings)

1. Go to https://supabase.com → New project. Pick a region close to your callers
   (US East). Save the database password.
2. Project Settings → **API**:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (secret — server only)
3. SQL Editor → New query → paste all of `supabase/schema.sql` → **Run**.
   You should see "Success. No rows returned." This also seeds a default agent profile.
4. (Recordings, later) Storage → New bucket → `call-recordings`, public.

## 2. Gemini Live (the voice + brain)

1. Go to https://aistudio.google.com → **Get API key**.
2. You must add billing: Billing → add a card → the Live API needs a funded account.
3. Create an API key → `GOOGLE_API_KEY`.
4. Model is preset to `gemini-2.0-flash-live-001` (`GEMINI_MODEL`). You can bump this
   to a newer Live model (e.g. a Gemini 2.5 / 3.x live model) by changing only the
   env var — no code change. The agent already applies long-call stability config
   (context-window compression + low end-of-speech sensitivity) so 8–12 minute
   sales calls don't freeze or cut off a pausing caller.

## 3. LiveKit (orchestration)

1. Go to https://livekit.io → start a free Cloud project.
2. Project → Settings → **Keys** → create a key.
3. Copy into the agent env:
   - WebSocket URL → `LIVEKIT_URL` (looks like `wss://xxxx.livekit.cloud`)
   - API Key → `LIVEKIT_API_KEY`
   - API Secret → `LIVEKIT_API_SECRET`

## 4. Telnyx (US phone number + SIP trunk)  — needed only for real calls

1. Go to https://telnyx.com → sign up (US/international; cheaper than Twilio).
2. **Numbers** → buy a US toll-free or local number. This becomes a *tracking
   number* — one per newspaper ad.
3. Create a **SIP Connection / FQDN connection** and point it at LiveKit's SIP
   ingress (LiveKit Cloud → Telephony shows the exact SIP URI + how to create the
   inbound trunk + dispatch rule). 
4. API key (Account → API Keys) → `TELNYX_API_KEY`.
5. In the dashboard, add the number under a campaign so calls attribute correctly.

> Local mic testing (step below) needs only Supabase + Gemini + LiveKit — you can
> skip Telnyx until you want a real phone call.

## 5. Payment (Authorize.net) — SANDBOX for now

1. Keep `PAYMENT_MODE=sandbox`. No bank needed; charges are simulated.
2. When your **US MOTO merchant account + US bank** are live, get sandbox creds at
   https://developer.authorize.net → `AUTHORIZENET_API_LOGIN_ID`,
   `AUTHORIZENET_TRANSACTION_KEY`, test the live provider, then flip
   `PAYMENT_MODE=live`. The card never touches this app (DTMF capture leg).

## 6. Internal secret

Generate a long random string for `INTERNAL_API_SECRET` (used to authenticate the
agent ↔ dashboard internal calls). Any 32+ char random value works.

---

## Run it

```bash
# Dashboard
cd dashboard && npm install && npm run dev      # http://localhost:3000

# Agent — local mic test (talk to it on your computer)
cd agent && npm install && npm run dev

# Agent — take real Telnyx calls
cd agent && npm start
```

## First test (no phone needed)

1. Configure Supabase + Gemini + LiveKit envs.
2. `cd agent && npm run dev` → it runs in console mode; speak into your mic and the
   agent responds with the Gemini Live voice.
3. Open the dashboard → a call row appears under **Call Logs**, and a contact under
   **CRM**. Try a sandbox sale — to simulate a decline, the payment sandbox declines
   any token containing "decline".

## Testing the payment paths (sandbox)

- **Approved sale:** complete the call normally → contact becomes a *client*, an
  `order_completed` event fires, a paid order appears on the contact.
- **Declined card:** the sandbox declines tokens containing "decline" → the contact
  gets a `card_declined` flag (red badge in CRM) and a `card_declined` event.
