# プラットフォーム指定を動的に変更
ARG TARGETPLATFORM
FROM --platform=$TARGETPLATFORM rockylinux:9.3-minimal

WORKDIR /opt/netapp/ai

RUN microdnf install -y \
    xz \
    cifs-utils \
    tar \
    make \
    gcc \
    gcc-c++ \
    python3 \
    python3-pip \
    nodejs \
    npm

ENV NODE_VERSION 22.2.0
RUN curl -fsSL https://raw.githubusercontent.com/tj/n/master/bin/n | bash -s latest \
    && npm install -g npm@latest

ENV PYTHON=/usr/bin/python3

ADD package.json ./
ADD package-lock.json ./
ADD src/ ./
ADD tsconfig.json ./

# pnpmインストールエラーを回避するため、npmを使用するか、pnpmを確実にインストール
RUN npm ci --only=production || npm install --force

RUN npm run build

ADD migrations ./migrations
ADD .env ./

# JSON形式のCMDに修正（警告解消）
CMD ["node", "dist/index.js"]