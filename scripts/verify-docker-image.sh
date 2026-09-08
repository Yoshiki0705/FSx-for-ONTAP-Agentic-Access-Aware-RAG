#!/bin/bash
#
# WebApp コンテナイメージの事前検証
#
# ECR にプッシュする前に、Lambda で起動できない典型的な失敗を先に落とす。
# 検査は 3 項目で、いずれも過去に実際に起きた失敗に対応している:
#   1. イメージが存在するか（ビルドの取り違え）
#   2. /app/server.js があるか（Next.js standalone 出力の欠落）
#   3. amd64 でビルドされているか（Apple Silicon で arm64 を作ってしまう）
#
# 使用方法:
#   bash scripts/verify-docker-image.sh <image>
#   bash scripts/verify-docker-image.sh permission-aware-rag-webapp:latest
#
# 終了コード: 0 = 全項目合格 / 1 = 1 つ以上不合格・引数不足
#
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "使用方法: $0 <image>" >&2
  exit 1
fi

IMAGE_NAME="$1"
checks_total=3
checks_passed=0

echo "🔍 イメージ検証: ${IMAGE_NAME}"

# 1. イメージの存在確認
if docker image inspect "${IMAGE_NAME}" > /dev/null 2>&1; then
  echo "✅ 1/${checks_total}: イメージが存在する"
  checks_passed=$((checks_passed + 1))
else
  echo "❌ 1/${checks_total}: イメージが存在しない"
  echo "   → docker buildx build ... -t ${IMAGE_NAME} を先に実行する"
  # 以降の検査はイメージが無いと実行できないため、ここで打ち切る
  echo ""
  echo "📊 検証結果: ${checks_passed}/${checks_total} 合格"
  exit 1
fi

# 2. /app/server.js の存在確認（Next.js standalone 出力）
if docker run --rm --entrypoint ls "${IMAGE_NAME}" /app/server.js > /dev/null 2>&1; then
  echo "✅ 2/${checks_total}: /app/server.js が存在する"
  checks_passed=$((checks_passed + 1))
else
  echo "❌ 2/${checks_total}: /app/server.js が無い"
  echo "   → next.config.js の output: 'standalone' と Dockerfile の COPY を確認する"
fi

# 3. アーキテクチャ確認（Lambda は amd64。Apple Silicon の既定は arm64）
image_arch="$(docker image inspect "${IMAGE_NAME}" --format '{{.Architecture}}')"
if [ "${image_arch}" = "amd64" ]; then
  echo "✅ 3/${checks_total}: アーキテクチャは amd64"
  checks_passed=$((checks_passed + 1))
else
  echo "❌ 3/${checks_total}: アーキテクチャが ${image_arch}（amd64 が必要）"
  echo "   → docker buildx build --platform linux/amd64 を指定する"
fi

echo ""
echo "📊 検証結果: ${checks_passed}/${checks_total} 合格"

if [ "${checks_passed}" -eq "${checks_total}" ]; then
  echo "✅ プッシュしてよい"
  exit 0
fi

echo "❌ 不合格の項目があるためプッシュしない"
exit 1
