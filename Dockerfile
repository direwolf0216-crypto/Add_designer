# ============================================
# Stage 1: Dependencies Installation
# ============================================
ARG NODE_VERSION=22-slim

FROM node:${NODE_VERSION} AS dependencies

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy package files to leverage Docker caching
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN npm ci --no-audit --no-fund

# ============================================
# Stage 2: Build Next.js application
# ============================================
FROM node:${NODE_VERSION} AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy dependencies from stage 1
COPY --from=dependencies /app/node_modules ./node_modules

# Copy all source code
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build Next.js (prisma generate already ran in postinstall).
# Schema changes are NOT applied here: run `npm run db:migrate:deploy` as a separate release step.
RUN npm run build

# ============================================
# Stage 3: Production Runner
# ============================================
FROM node:${NODE_VERSION} AS runner

WORKDIR /app

# Install OpenSSL for Prisma runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Business runs in IST; day/month boundaries are also computed explicitly in src/lib/dates.ts.
ENV TZ=Asia/Kolkata

# Copy public assets
COPY --from=builder --chown=node:node /app/public ./public

# Create .next directory
RUN mkdir .next && chown node:node .next

# Copy standalone output and static files
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Switch to non-root user
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/ping').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
