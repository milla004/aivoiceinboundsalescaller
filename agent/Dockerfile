# =============================================================================
# Agent worker — LiveKit + Gemini Live voice agent.
# Always-on Node process. Coolify: set Base Directory = /agent, Dockerfile build.
# =============================================================================
FROM node:22-slim

# LiveKit agents need some native audio/runtime libs available.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      python3 \
      make \
      g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first (better layer caching).
COPY package.json package-lock.json ./
RUN npm ci

# App source.
COPY . .

# Download model files (Silero VAD etc.) at build time so first call is fast.
RUN npx tsx src/agent.ts download-files || true

# The worker connects out to LiveKit Cloud; no inbound port needed.
CMD ["npx", "tsx", "src/agent.ts", "start"]
