# プラットフォーム指定を動的に変更
ARG TARGETPLATFORM
FROM --platform=$TARGETPLATFORM public.ecr.aws/lambda/nodejs:18

WORKDIR ${LAMBDA_TASK_ROOT}

# パッケージファイルをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm ci --only=production

# ソースコードをコピー
COPY . .

# ビルド（必要に応じて）
RUN npm run build 2>/dev/null || echo "No build script found"

# JSON形式のCMDに修正
CMD ["index.handler"]