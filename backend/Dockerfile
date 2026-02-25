FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Install all deps (dev included) so nest CLI is available for build
RUN npm ci && npx prisma generate

COPY . .

# Build and then prune dev dependencies
RUN npm run build && npm prune --production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

CMD ["node", "dist/src/main"]
