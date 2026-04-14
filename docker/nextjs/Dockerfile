# ============================================================
# Permission-aware RAG WebApp — Docker Build
#
# 【アーキテクチャ設計方針】
#   Lambda関数は x86_64 (amd64) で動作します。
#   このDockerfileは常に linux/amd64 イメージを生成します。
#
#   ⚠️ Lambda Architecture を arm64 に変更しないでください。
#   EC2 (Amazon Linux 2, x86_64) でビルドしたイメージとの
#   互換性が失われ、デプロイ環境間で差分が発生します。
#
#   ビルド環境ごとの動作:
#     EC2 (x86_64)       → ネイティブビルド（高速）
#     Apple Silicon (M1+) → qemuエミュレーション（低速）
#                           → 高速化には Dockerfile.prebuilt を使用
#
# ビルド方法:
#   docker build -t webapp .
#
# 【Apple Silicon (M1+) でのビルド注意事項】
#   BuildKit使用時、Lambda互換のDockerマニフェスト形式にするため
#   以下のフラグが必須:
#     docker buildx build --platform linux/amd64 \
#       --provenance=false --sbom=false --output type=docker \
#       -t <ecr-uri>:latest -f Dockerfile .
#
#   ⚠️ --provenance=false --sbom=false --output type=docker を
#   省略すると OCI image index 形式になり、Lambda の
#   UpdateFunctionCode で "image manifest not supported" エラーが発生します。
# ============================================================

# --- Stage 1: ビルド ---
# --platform=linux/amd64: Lambda x86_64 と一致させるため固定。
# Apple Silicon では qemu エミュレーションで動作する。
FROM --platform=linux/amd64 public.ecr.aws/docker/library/node:22-slim AS builder
WORKDIR /app

# v4.0.0 フィーチャーフラグ（ビルド時に NEXT_PUBLIC_* としてインライン化）
# docker build --build-arg NEXT_PUBLIC_VOICE_CHAT_ENABLED=true ... で指定
ARG NEXT_PUBLIC_VOICE_CHAT_ENABLED=false
ARG NEXT_PUBLIC_GUARDRAILS_ENABLED=false
ARG NEXT_PUBLIC_ENABLE_AGENT_REGISTRY=false
ARG NEXT_PUBLIC_AGENT_REGISTRY_REGION=ap-northeast-1
ARG NEXT_PUBLIC_AGENT_POLICY_ENABLED=false
ARG NEXT_PUBLIC_EPISODIC_MEMORY_ENABLED=false

ENV NEXT_PUBLIC_VOICE_CHAT_ENABLED=$NEXT_PUBLIC_VOICE_CHAT_ENABLED
ENV NEXT_PUBLIC_GUARDRAILS_ENABLED=$NEXT_PUBLIC_GUARDRAILS_ENABLED
ENV NEXT_PUBLIC_ENABLE_AGENT_REGISTRY=$NEXT_PUBLIC_ENABLE_AGENT_REGISTRY
ENV NEXT_PUBLIC_AGENT_REGISTRY_REGION=$NEXT_PUBLIC_AGENT_REGISTRY_REGION
ENV NEXT_PUBLIC_AGENT_POLICY_ENABLED=$NEXT_PUBLIC_AGENT_POLICY_ENABLED
ENV NEXT_PUBLIC_EPISODIC_MEMORY_ENABLED=$NEXT_PUBLIC_EPISODIC_MEMORY_ENABLED

COPY . .
RUN npm install
RUN npm run build

# --- Stage 2: ランタイム ---
# --platform=linux/amd64: Lambda x86_64 と一致させるため固定。
FROM --platform=linux/amd64 public.ecr.aws/docker/library/node:22-slim AS runner

# Lambda Web Adapter: x86_64 専用タグを明示指定。
# arm64 タグ (0.9.1-aarch64) に変更しないこと — Lambda が x86_64 のため。
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1-x86_64 /lambda-adapter /opt/extensions/lambda-adapter

ENV PORT=3000
ENV NODE_ENV=production
ENV AWS_LWA_ENABLE_COMPRESSION=true
ENV HOSTNAME=0.0.0.0

WORKDIR /app

# Next.js standalone ビルド成果物（アーキテクチャ非依存、純粋 Node.js）
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/i18n.ts ./i18n.ts
COPY --from=builder /app/messages ./messages
COPY --from=builder /app/src/i18n ./src/i18n
COPY --from=builder /app/run.sh ./run.sh

RUN ln -s /tmp/cache ./.next/cache
RUN chmod +x ./run.sh

EXPOSE 3000
CMD exec ./run.sh
