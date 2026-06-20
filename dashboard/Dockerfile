# =============================================================================
# Dashboard — Next.js 16 (standalone output).
# Coolify: set Base Directory = /dashboard, Dockerfile build, Port = 3000.
# Multi-stage: build deps -> build -> minimal runtime.
# =============================================================================

# ---- 1. Install dependencies -----------------------------------------------
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- 2. Build --------------------------------------------------------------
FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time public env vars must be present for Next to inline them.
# (NEXT_PUBLIC_* are baked at build; provide them as Coolify build args/env.)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- 3. Runtime (minimal) --------------------------------------------------
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone output bundles only what's needed to run.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
