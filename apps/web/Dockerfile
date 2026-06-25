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
CMD ["node", "server.js"]
