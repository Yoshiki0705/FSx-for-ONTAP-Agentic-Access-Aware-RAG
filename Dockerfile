# Multi-stage build for Next.js Lambda deployment
FROM --platform=linux/amd64 public.ecr.aws/docker/library/node:20.9.0-slim AS builder

WORKDIR /app

# Copy package files
COPY docker/nextjs/package*.json ./
RUN npm install

# Copy source code
COPY docker/nextjs/ ./

# Build the application
RUN npm run build

# Production stage
FROM --platform=linux/amd64 public.ecr.aws/docker/library/node:20.9.0-slim AS runner

# Install Lambda Web Adapter
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.0-x86_64 /lambda-adapter /opt/extensions/lambda-adapter

# Environment variables
ENV PORT=3000 
ENV NODE_ENV=production 
ENV AWS_LWA_ENABLE_COMPRESSION=true
ENV HOSTNAME=0.0.0.0

WORKDIR /app

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/messages ./messages
COPY --from=builder /app/run.sh ./run.sh

# Create cache symlink
RUN ln -s /tmp/cache ./.next/cache
RUN chmod +x ./run.sh

# Copy i18n configuration files
COPY --from=builder /app/i18n.ts ./i18n.ts
COPY --from=builder /app/src ./src

EXPOSE 3000

CMD exec ./run.sh