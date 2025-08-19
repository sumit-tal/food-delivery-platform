# syntax=docker/dockerfile:1

# Base image
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
# Use npm cache for faster installs
RUN --mount=type=cache,target=/root/.npm \
    sh -c 'if [ -f package-lock.json ]; then npm ci; else npm install; fi'

# Build the application
FROM deps AS build
WORKDIR /app
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build
# Remove devDependencies for production image
RUN npm prune --omit=dev

# Production runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Create non-root user
RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs
# Copy built artifacts and production deps
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./
EXPOSE 3000
USER nodeuser
CMD ["node", "dist/main.js"]
