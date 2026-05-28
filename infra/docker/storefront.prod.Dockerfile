# --- Builder ---
FROM node:20-alpine AS builder

WORKDIR /app
COPY storefront/package.json storefront/package-lock.json ./
RUN npm ci

COPY storefront/ .

# Build args become env at build time
ARG NEXT_PUBLIC_BRAND_NAME="Elder"
ARG NEXT_PUBLIC_BRAND_TAGLINE="Indigenous Streetwear"
ARG NEXT_PUBLIC_BRAND_COLOR_PRIMARY="#1A1A1A"
ARG NEXT_PUBLIC_BRAND_COLOR_ACCENT="#C53030"
ARG NEXT_PUBLIC_SITE_URL="https://store.example.com"

ENV NEXT_PUBLIC_BRAND_NAME=$NEXT_PUBLIC_BRAND_NAME
ENV NEXT_PUBLIC_BRAND_TAGLINE=$NEXT_PUBLIC_BRAND_TAGLINE
ENV NEXT_PUBLIC_BRAND_COLOR_PRIMARY=$NEXT_PUBLIC_BRAND_COLOR_PRIMARY
ENV NEXT_PUBLIC_BRAND_COLOR_ACCENT=$NEXT_PUBLIC_BRAND_COLOR_ACCENT
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

RUN npm run build

# --- Runtime ---
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

# Copy only what Next.js needs at runtime
COPY --from=builder /app/package.json ./
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

# API_URL is set at runtime via docker-compose env
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

CMD ["node", "server.js"]
