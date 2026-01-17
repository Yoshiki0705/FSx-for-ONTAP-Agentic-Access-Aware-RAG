# Lambda用のベースイメージを使用
FROM public.ecr.aws/lambda/nodejs:18

# 作業ディレクトリを設定
WORKDIR ${LAMBDA_TASK_ROOT}

# パッケージファイルをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm ci --only=production

# ソースコードをコピー
COPY . .

# ビルド（必要に応じて）
RUN npm run build 2>/dev/null || echo "No build script found"

# Lambda関数のハンドラーを指定
CMD ["index.handler"]