FROM node:24-bookworm-slim AS deps

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma

# PDF export uses the system Chromium installed in the runner stage
ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN npm install --include=optional

FROM node:24-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN npm run build


FROM node:24-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Chromium for Puppeteer PDF export and OpenSSL for Prisma runtime.
# apt is switched to HTTPS first: some networks (campus/office firewalls) block large
# downloads like the 80 MB chromium .deb over plain HTTP but let HTTPS through.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && sed -i 's#http://deb.debian.org#https://deb.debian.org#g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-freefont-ttf \
    openssl \
    adduser \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/chromium /usr/bin/chromium-browser

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN addgroup --system --gid 1001 nodejs
# A real home directory: Chromium (PDF export) won't start when HOME is /nonexistent
RUN adduser --system --uid 1001 --ingroup nodejs --home /home/nextjs nextjs

COPY --from=builder /app/public ./public
# Owned by the app user so Next.js can write its runtime cache (.next/cache)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma CLI + schema, so docker-compose's "migrate" service can set up the database from this image
COPY --from=builder /app/prisma ./prisma
COPY --from=deps /app/node_modules/prisma ./node_modules/prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000

ENV PORT=3000

CMD ["node", "server.js"]