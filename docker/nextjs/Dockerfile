FROM --platform=linux/amd64 public.ecr.aws/docker/library/node:20.9.0-slim AS builder
WORKDIR /app

COPY . .
RUN npm install
RUN npm run build

FROM --platform=linux/amd64 public.ecr.aws/docker/library/node:20.9.0-slim AS runner
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.0-x86_64 /lambda-adapter /opt/extensions/lambda-adapter

ENV PORT=3000 
ENV NODE_ENV=production 
ENV AWS_LWA_ENABLE_COMPRESSION=true
ENV HOSTNAME=0.0.0.0

WORKDIR /app
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/messages ./messages
COPY --from=builder /app/run.sh ./run.sh
RUN ln -s /tmp/cache ./.next/cache
RUN chmod +x ./run.sh

# i18n設定ファイルをコピー（プロジェクトルートとsrcディレクトリ）
# Next.js 15はプロジェクトルートのi18n.tsを優先的に探す
COPY --from=builder /app/i18n.ts ./i18n.ts
COPY --from=builder /app/src ./src

EXPOSE 3000

CMD exec ./run.sh