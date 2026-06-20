# Inbound AI Voice Sales Agent

A US-market inbound voice agent that answers calls from your newspaper ad, runs
Caleb O'Dowd's 10-step inbound close, takes payment by DTMF (PCI out-of-scope),
and tracks everything in a CRM + KPI dashboard.

**Stack:** Next.js dashboard · LiveKit + Gemini Live voice agent · Telnyx (US SIP) ·
Supabase (data + recordings) · Authorize.net (sandbox for now).

```
ai-voice-agent/
├── dashboard/        Next.js app — CRM, campaigns, agent profiles, KPI dashboard
├── agent/            LiveKit voice-agent worker (Gemini Live)
├── supabase/         schema.sql — run this in your Supabase project
├── docs/             setup guides
└── .env.example      copy to dashboard/.env.local and agent/.env
```

## Status

| Piece | State |
|---|---|
| Dashboard + CRM + KPI + agent-profile editor | Built, builds clean |
| Voice agent (Caleb 10-step, compliance guardrail, FAQ) | Built, typechecks clean |
| CRM triggers (card_declined flag, order_completed) | Built |
| Payment | **Sandbox only** — no real charges until you have a US MOTO merchant account + bank |
| Live test call | Needs API keys (see `docs/SETUP.md`) |

## Quick start

1. **Database:** create a Supabase project, open SQL Editor, paste & run
   `supabase/schema.sql`.
2. **Keys:** copy `.env.example` → `dashboard/.env.local` and `agent/.env`, fill in
   (see `docs/SETUP.md` for where each key comes from).
3. **Dashboard:** `cd dashboard && npm run dev` → http://localhost:3000
4. **Agent (local mic test):** `cd agent && npm run dev`
5. **Agent (take real calls):** `cd agent && npm start` (after Telnyx → LiveKit SIP is wired)

## Important guardrails

- **Do not take live payments** until a US MOTO merchant account + bank are active.
  Keep `PAYMENT_MODE=sandbox`.
- The compliance filter is a **safety net, not legal sign-off.** Have US counsel
  review the actual sales script before running real ads (Caleb budgets ~$2,500).
- Some US states require disclosing the call is recorded and/or AI — the opening
  greeting (editable per agent profile) handles this; keep it enabled.
