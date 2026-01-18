#!/bin/bash
set -euo pipefail

echo "🚀 AD Sync Lambda再デプロイ開始"
echo "================================"

LAMBDA_DIR="lambda/agent-core-ad-sync"
FUNCTION_NAME="permission-aware-rag-prod-ad-sync"
REGION="ap-northeast-1"

# 1. TypeScriptコンパイル
echo "📦 Step 1: TypeScriptコンパイル..."
cd "$LAMBDA_DIR"
npm run build

if [ ! -f "dist/index.js" ]; then
  echo "❌ エラー: dist/index.js が見つかりません"
  exit 1
fi

echo "✅ TypeScriptコンパイル成功"

# 2. デプロイパッケージ作成
echo "📦 Step 2: デプロイパッケージ作成..."
rm -rf deployment-package deployment-package.zip
mkdir -p deployment-package

# ✅ index.jsをルートにコピー（dist/index.jsではない）
cp dist/index.js deployment-package/
cp package.json deployment-package/

# 3. 本番用依存関係をインストール
echo "📦 Step 3: 本番用依存関係インストール..."
cd deployment-package
npm install --production --no-package-lock

# 4. ZIPファイル作成
echo "📦 Step 4: ZIPファイル作成..."
zip -r ../deployment-package.zip . > /dev/null

# 5. Lambda関数更新
echo "🚀 Step 5: Lambda関数更新..."
cd ..
aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --zip-file fileb://deployment-package.zip

echo "⏳ Lambda関数更新完了を待機中..."
sleep 10

# 6. 更新確認
echo "🔍 Step 6: 更新確認..."
aws lambda get-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --query '{Handler:Handler,Runtime:Runtime,CodeSha256:CodeSha256,LastModified:LastModified}' \
  --output table

echo ""
echo "✅ AD Sync Lambda再デプロイ完了"
echo "================================"
