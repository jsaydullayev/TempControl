# syntax=docker/dockerfile:1

# Multi-stage so the shipped image carries the built app and nothing else —
# no source, no dev dependencies, no build cache.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# next.config.ts sets output: "standalone", so the build emits a self-contained
# server with only the modules it actually imports.
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Tuya signs every request with a millisecond timestamp; a container running on
# the wrong clock gets error 1013 and nothing else explains why.
ENV TZ=Asia/Tashkent

# Never run as root: a compromised process should not own the filesystem.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
# The worker and the migration/seed scripts are not part of the Next build.
COPY --from=build --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nextjs:nodejs /app/src ./src
COPY --from=build --chown=nextjs:nodejs /app/worker ./worker
COPY --from=build --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=build --chown=nextjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

USER nextjs
EXPOSE 3000

# `next start` does NOT work with output: standalone — the standalone server is
# its own entry point.
CMD ["node", "server.js"]
