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

# 1. standaloneビルドをコピー（これがベース）
COPY --from=builder /app/.next/standalone ./

# 2. 静的アセットをコピー
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# 3. 設定ファイルをコピー（standaloneに含まれない場合があるため明示的にコピー）
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js

# 4. i18n関連ファイルをコピー（重要！）
COPY --from=builder /app/i18n.ts ./i18n.ts
COPY --from=builder /app/messages ./messages

# 5. srcディレクトリをコピー（i18n/request.tsなどが含まれる）
COPY --from=builder /app/src/i18n ./src/i18n

# 6. 実行スクリプトをコピー
COPY --from=builder /app/run.sh ./run.sh

# 7. キャッシュディレクトリのシンボリックリンク作成
RUN ln -s /tmp/cache ./.next/cache

# 8. 実行権限付与
RUN chmod +x ./run.sh

EXPOSE 3000

CMD exec ./run.sh