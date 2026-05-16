FROM node:22-alpine AS base

# Install all deps (dev + prod) for building
FROM base AS deps
WORKDIR /app
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci

# Build the web app
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/web ./
RUN npm run build

# Production image — prod deps only + build output
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/build ./build
COPY --from=builder /app/server.js ./server.js
EXPOSE 3000
CMD ["node", "server.js"]
