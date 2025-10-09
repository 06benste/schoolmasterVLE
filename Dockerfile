# Multi-stage build for SchoolMaster application
FROM node:18-alpine AS base

# Build the application
FROM base AS builder
WORKDIR /app

# Set base URL as ENV so it's available to all commands
ENV VITE_BASE_URL=/

# Copy full source first to avoid Kaniko cache quirks dropping files
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Verify source files are copied
RUN echo "=== Checking backend directory structure ===" && ls -la backend/ && echo "=== Checking if src directory exists ===" && ls -la backend/src/

## Install deps and build backend
WORKDIR /app/backend
RUN npm install && npx tsc --project tsconfig.json

# Build frontend (VITE_BASE_URL is already in environment)
WORKDIR /app/frontend
RUN rm -rf dist && echo "Building with VITE_BASE_URL=$VITE_BASE_URL" && npm install && npm run build

# Production image
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/backend/dist ./backend/dist
COPY --from=builder --chown=nextjs:nodejs /app/backend/package*.json ./backend/
COPY --from=builder --chown=nextjs:nodejs /app/frontend/dist ./frontend/dist
COPY --from=builder --chown=nextjs:nodejs /app/frontend/package*.json ./frontend/

# Install production dependencies only
WORKDIR /app/backend
RUN npm install --omit=dev

WORKDIR /app/frontend  
RUN npm install --omit=dev

# Ensure runtime working directory is repo root
WORKDIR /app

# Create data directories
RUN mkdir -p /app/data/uploads && chown -R nextjs:nodejs /app/data

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/app.db
ENV UPLOADS_DIR=/app/data/uploads

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/status/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application (absolute path to avoid WORKDIR issues)
CMD ["node", "/app/backend/dist/index.js"]
