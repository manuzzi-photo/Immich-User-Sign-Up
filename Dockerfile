# syntax=docker/dockerfile:1

# ---------- Stage 1: build the React frontend ----------
FROM node:20-slim AS web-builder
WORKDIR /web
COPY web/package.json web/package-lock.json* ./
RUN npm install
COPY web/ ./
RUN npm run build

# ---------- Stage 2: install backend dependencies ----------
FROM node:20-slim AS server-deps
WORKDIR /server
# Build tools required to compile the better-sqlite3 native addon.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev

# ---------- Stage 3: runtime image ----------
FROM node:20-slim AS runtime
LABEL org.opencontainers.image.source="https://github.com/manuzzi-photo/Immich-User-Sign-Up"
LABEL org.opencontainers.image.description="Self sign-up webapp for an existing Immich instance (invite codes + admin approval)"
LABEL org.opencontainers.image.licenses="GPL-3.0"
ENV NODE_ENV=production
WORKDIR /app/server

COPY --from=server-deps /server/node_modules ./node_modules
COPY server/package.json ./package.json
COPY server/src ./src
COPY --from=web-builder /web/dist /app/web/dist

# Persisted SQLite database lives here (mount a volume).
RUN mkdir -p /app/server/data
ENV DATABASE_PATH=/app/server/data/app.db

EXPOSE 2284
CMD ["node", "src/index.js"]
