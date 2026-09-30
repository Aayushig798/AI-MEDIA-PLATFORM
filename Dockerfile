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

# Chromium for Puppeteer PDF export and OpenSSL for Prisma runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-freefont-ttf \
    openssl \
    ca-certificates \
    adduser \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/chromium /usr/bin/chromium-browser

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000

CMD ["node", "server.js"]