# ── Stage 1: build the Vite frontend ────────────────────────────────────────
FROM oven/bun:1 AS builder
WORKDIR /build

COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build          # produces /build/dist


# ── Stage 2: lean production image ──────────────────────────────────────────
FROM oven/bun:1-slim AS runner
WORKDIR /app

# Install only runtime (non-dev) dependencies
COPY package.json bun.lock bunfig.toml ./
RUN bun install --production --frozen-lockfile

# Frontend assets built in stage 1
COPY --from=builder /build/dist ./dist

# Server source (Bun runs TypeScript directly — no compile step needed)
COPY server ./server
COPY tsconfig.json ./

# The Bun server will be started with /app as CWD (overridden by compose to
# /data so that data.db lands on the persistent volume instead of /app).
EXPOSE 3000
ENV NODE_ENV=production

# Use an absolute path so the working-dir override in compose doesn't break
# module resolution (import.meta.dir will still resolve to /app/server).
CMD ["bun", "/app/server/index.ts"]
