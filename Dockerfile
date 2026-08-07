# Payload CMS Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package.json ./

# Install dependencies with legacy-peer-deps to avoid conflicts
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Ensure public directory exists
RUN mkdir -p public

# Build Next.js application
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy build artifacts
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000

CMD ["npm", "start"]
