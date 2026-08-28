# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_PATH=/tmp/callaudit.json
ENV UPLOAD_DIR=/tmp/uploads
ENV KEEP_AUDIO=false
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache su-exec \
  && addgroup -S nodejs && adduser -S nextjs -G nodejs \
  && mkdir -p /tmp/uploads /data/uploads \
  && chown -R nextjs:nodejs /tmp/uploads /data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Write the entrypoint in the Linux image so Windows CRLF cannot break exec
RUN printf '%s\n' \
  '#!/bin/sh' \
  'set -e' \
  'mkdir -p /tmp/uploads /data/uploads' \
  'if [ "$(id -u)" = "0" ]; then' \
  '  chown -R nextjs:nodejs /tmp/uploads /data 2>/dev/null || true' \
  '  exec su-exec nextjs node server.js' \
  'fi' \
  'exec node server.js' \
  > /app/docker-entrypoint.sh \
  && chmod +x /app/docker-entrypoint.sh

EXPOSE 3000
VOLUME ["/data"]
ENTRYPOINT ["/bin/sh", "/app/docker-entrypoint.sh"]
