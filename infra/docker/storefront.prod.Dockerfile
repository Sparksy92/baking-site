# --- Builder ---
FROM node:20-alpine AS builder

WORKDIR /app
COPY storefront/package.json storefront/package-lock.json ./
RUN npm ci

COPY storefront/ .
RUN npm run build

# --- Runtime ---
FROM node:20-alpine

WORKDIR /app
RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
