# FSx ONTAP Embedding Server
# CIFSマウントされたドキュメントをBedrock Titan Embed v2でベクトル化し
# OpenSearch Serverlessにインデックスする

FROM --platform=linux/amd64 node:22-slim

WORKDIR /opt/netapp/ai

# cifs-utils for CIFS mount (if needed inside container)
RUN apt-get update && apt-get install -y --no-install-recommends \
    cifs-utils \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Dependencies (install all for build, then prune)
COPY package.json ./
RUN npm install

# Source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN ./node_modules/.bin/tsc

# Prune dev dependencies
RUN npm prune --omit=dev

# Create data/db mount points
RUN mkdir -p /opt/netapp/ai/data /opt/netapp/ai/db

# Copy .env as defaults (overridden by Docker -e flags)
COPY .env ./

CMD ["node", "dist/index.js"]
