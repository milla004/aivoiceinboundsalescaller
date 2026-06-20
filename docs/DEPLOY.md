# Phase 5 — Deploy to Vultr + Coolify (two services)

Your project is a **monorepo with two separate services** that deploy as
**two separate Coolify resources** from the same GitHub repo:

| Service     | Coolify Base Directory | Build        | Port  | Public? |
|-------------|------------------------|--------------|-------|---------|
| `dashboard` | `/dashboard`           | Dockerfile   | 3000  | Yes (web UI) |
| `agent`     | `/agent`               | Dockerfile   | —     | No (outbound worker only) |

> This replaces the single-app flow shown in the YouTube video. Do NOT deploy
> the repo root as one app — you must add two resources.

---

## Step 1 — Already done
- ✅ Coolify installed, opened at `http://45.77.218.250:8000/`, admin created
- ✅ GitHub connected to Coolify
- ✅ Supabase schema run (success)

---

## Step 2 — Add the DASHBOARD resource
1. Coolify → your project → **+ New** → **Public/Private Repository** → pick
   `milla004/aivoiceinboundsalescaller`.
2. **Branch:** `main`.
3. **Base Directory:** `/dashboard`
4. **Build Pack:** **Dockerfile** (Coolify finds `/dashboard/Dockerfile`).
5. **Port:** `3000`.
6. Save. **Don't deploy yet** — add env vars first (Step 4).

## Step 3 — Add the AGENT resource
1. Same project → **+ New** → same repo.
2. **Branch:** `main`.
3. **Base Directory:** `/agent`
4. **Build Pack:** **Dockerfile**.
5. No public port (it dials out to LiveKit). If Coolify forces a port, leave
   default and don't expose a domain.
6. Save. **Don't deploy yet.**

---

## Step 4 — Environment variables (paste your REAL keys)

Paste these in each resource's **Environment Variables** tab (developer view).
Values are the real ones you collected — NOT the `.env.example` placeholders.

### DASHBOARD env vars
```
NEXT_PUBLIC_SUPABASE_URL=<your supabase url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon key>
SUPABASE_SERVICE_ROLE_KEY=<your service role key>
PAYMENT_MODE=sandbox
AUTHORIZENET_API_LOGIN_ID=<sandbox login, or leave blank for now>
AUTHORIZENET_TRANSACTION_KEY=<sandbox key, or leave blank for now>
INTERNAL_API_SECRET=<make up a long random string>
```
> `NEXT_PUBLIC_*` are baked at build time — set them BEFORE first deploy. If you
> change them later, redeploy.

### AGENT env vars
```
LIVEKIT_URL=<wss://...livekit.cloud>
LIVEKIT_API_KEY=<your livekit api key>
LIVEKIT_API_SECRET=<your livekit api secret>
GOOGLE_API_KEY=<your gemini api key>
GEMINI_MODEL=gemini-2.0-flash-live-001
NEXT_PUBLIC_SUPABASE_URL=<your supabase url>
SUPABASE_SERVICE_ROLE_KEY=<your service role key>
TELNYX_API_KEY=<your telnyx api key>
INTERNAL_API_SECRET=<same value as dashboard>
```

---

## Step 5 — Deploy both
Deploy the dashboard, then the agent. Watch logs:
- Dashboard: should end with `Ready on http://0.0.0.0:3000`.
- Agent: should log `registered worker` / `connecting to LiveKit`.

Open the dashboard's Coolify URL → you should see the KPI dashboard.

---

## Step 6 — LiveKit inbound trunk + dispatch rule
Done from this machine (or via Coolify terminal). Maps +18446911090 → the agent.
See `docs/SETUP.md` and the Phase 5 conversation — this is the final wiring
before the test call.

---

## Step 7 — Test call
Call **+1 844 691 1090** from your phone. The agent answers, runs the greeting,
and the call appears in **Call Logs** in the dashboard.
