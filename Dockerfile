# syntax=docker/dockerfile:1

# Stage 1: Install dependencies
FROM oven/bun:1.3.9 AS deps
WORKDIR /app
COPY package.json bun.lock ./
# Cache mount: Bun keeps downloaded packages in the persistent NAS builder, so
# installs don't re-download on every deploy. Explicit cache dir avoids guessing
# the image's HOME (BUN_INSTALL_CACHE_DIR is honored — verified).
RUN --mount=type=cache,target=/bun-cache \
    BUN_INSTALL_CACHE_DIR=/bun-cache bun install --frozen-lockfile

# Stage 2: Build
FROM oven/bun:1.3.9 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Pins the SW cache version (pages-/static-<id>) at build time so each deploy
# rotates caches deterministically. Empty/unset falls back to a random id per
# build in next.config.ts. Passed via deploy.sh's --build-arg (git short SHA).
ARG SW_BUILD_ID
ENV SW_BUILD_ID=${SW_BUILD_ID}
# Cache mount: persist Next.js' compilation cache (.next/cache) across builds —
# the biggest win on the slow NAS, since re-deploys then only recompile what
# changed. The mount is ephemeral (not in the image) and leaves the standalone
# output (.next/standalone) untouched. Call next via its real path (not the
# .bin/next symlink): the baseline bun build on the NAS (older CPU, no AVX2)
# resolves the symlink's relative require ('../server/require-hook') from the
# wrong dir, so the .bin shim fails. The real path keeps __dirname correct.
RUN --mount=type=cache,target=/app/.next/cache \
    bun --bun node_modules/next/dist/bin/next build

# Stage 3: Production runner
FROM oven/bun:1.3.9-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# CLI user management (scripts/manage-users.ts) only reaches lib/users +
# lib/fsHelpers, whose sole external deps (uuid, gray-matter, zod) are already
# traced into the Next standalone node_modules copied above. So NO separate
# `bun install --production` is needed — dropping it removes a ~124 MB
# node_modules layer, which shrinks the image and fixes the slow/timeout-prone
# `--load` export (the session was dying while exporting that layer).
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/lib ./lib
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["bun", "server.js"]
