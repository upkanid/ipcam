FROM node:22-alpine AS base

# Build the web app
FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/desktop/package.json ./apps/desktop/
RUN npm ci -w web
COPY apps/web ./apps/web
WORKDIR /app/apps/web
RUN npm run build

# Production image — prod deps only + build output
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/desktop/package.json ./apps/desktop/
RUN npm ci -w web --omit=dev
COPY --from=builder /app/apps/web/build ./build
COPY --from=builder /app/apps/web/server.js ./server.js
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz >/dev/null || exit 1
CMD ["node", "server.js"]
