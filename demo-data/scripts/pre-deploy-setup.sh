#!/bin/bash
set -euo pipefail
#
# Permission-aware RAG プリデプロイセットアップ
#
# CDKデプロイ前に実行する必要があるリソースを作成します。
# WebAppスタックはECRリポジトリにDockerイメージが必要なため、
# CDKデプロイ前にイメージをビルド・プッシュしておく必要があります。
#
# 使用方法:
#   bash demo-data/scripts/pre-deploy-setup.sh
#
# 前提条件:
#   - AWS CLI設定済み（適切なIAM権限）
#   - CDK Bootstrap済み

REGION="${AWS_REGION:-ap-northeast-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="permission-aware-rag-webapp"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "============================================"
echo "  プリデプロイセットアップ"
echo "============================================"
echo "  Account: $ACCOUNT_ID"
echo "  Region: $REGION"
echo ""

# ========================================
# 1. ECRリポジトリ作成
# ========================================
echo "📦 Step 1: ECRリポジトリ作成..."
aws ecr create-repository --repository-name $ECR_REPO --region $REGION 2>/dev/null \
  && echo "  ✅ ECR repository created: $ECR_REPO" \
  || echo "  ⏭️ ECR repository already exists"

ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}"
echo ""

# ========================================
# 2. Dockerイメージビルド + プッシュ
# ========================================
echo "🐳 Step 2: Dockerイメージビルド..."

# Docker利用可能チェック
if command -v docker &> /dev/null && docker info &> /dev/null; then
  echo "  Docker detected, building locally..."
  aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com
  IMAGE_TAG="initial-$(date +%Y%m%d-%H%M%S)"

  # ========================================
  # アーキテクチャ検出と分岐
  # ========================================
  # 【設計方針】
  #   生成するDockerイメージは常に x86_64 (amd64)。
  #   Lambda関数が x86_64 で動作するため、ビルドホストに関わらず
  #   x86_64 イメージを生成する必要がある。
  #
  #   EC2 (x86_64):
  #     → Dockerfile でフルビルド（ネイティブ、高速）
  #   Apple Silicon (arm64):
  #     → Dockerfile.prebuilt でプリビルドモード
  #       1. ローカルで npm run build（ネイティブ、高速）
  #       2. x86_64 Lambda Adapter バイナリを取得
  #       3. x86_64 ベースイメージにパッケージング
  #       ※ Next.js standalone は純粋 Node.js でアーキテクチャ非依存
  #
  #   ⚠️ arm64 イメージを生成しないこと。
  #      Lambda が x86_64 のため "exec format error" になる。
  # ========================================
  HOST_ARCH=$(uname -m)
  if [ "$HOST_ARCH" = "arm64" ] || [ "$HOST_ARCH" = "aarch64" ]; then
    echo "  🍎 Apple Silicon detected — using prebuilt mode (local Next.js build + Docker package)"
    echo "  📦 Building Next.js locally..."
    (cd ${PROJECT_ROOT}/docker/nextjs && npm install && NODE_ENV=production npm run build)

    echo "  📥 Fetching x86_64 Lambda Adapter..."
    # ⚠️ --platform linux/amd64 を必ず指定すること。
    #    省略すると arm64 バイナリが取得され Lambda で動作しない。
    docker pull --platform linux/amd64 public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 || true
    LWA_ID=$(docker create --platform linux/amd64 public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /bin/true 2>/dev/null) || true
    if [ -n "$LWA_ID" ]; then
      docker cp $LWA_ID:/lambda-adapter ${PROJECT_ROOT}/docker/nextjs/lambda-adapter
      docker rm $LWA_ID > /dev/null 2>&1
    fi

    echo "  🐳 Building Docker image (prebuilt mode, x86_64 target)..."
    docker build --no-cache \
      -t ${ECR_URI}:${IMAGE_TAG} \
      -f ${PROJECT_ROOT}/docker/nextjs/Dockerfile.prebuilt \
      ${PROJECT_ROOT}/docker/nextjs/
  else
    echo "  🖥️ x86_64 detected — using full Docker build"
    docker build --no-cache \
      -t ${ECR_URI}:${IMAGE_TAG} \
      -f ${PROJECT_ROOT}/docker/nextjs/Dockerfile \
      ${PROJECT_ROOT}/docker/nextjs/
  fi

  docker tag ${ECR_URI}:${IMAGE_TAG} ${ECR_URI}:latest
  docker push ${ECR_URI}:${IMAGE_TAG}
  docker push ${ECR_URI}:latest
  echo "  ✅ Image pushed: ${IMAGE_TAG}"
else
  echo "  Docker not available, using CodeBuild..."

  # S3にソースアップロード
  DATA_BUCKET="perm-rag-demo-demo-kb-data-${ACCOUNT_ID}"
  # S3バケットがまだない場合（CDKデプロイ前）はスキップ
  if ! aws s3 ls "s3://${DATA_BUCKET}" --region $REGION 2>/dev/null; then
    echo "  ⚠️ S3 bucket not found. Creating temporary bucket..."
    DATA_BUCKET="perm-rag-codebuild-${ACCOUNT_ID}"
    aws s3 mb "s3://${DATA_BUCKET}" --region $REGION 2>/dev/null || true
  fi

  rm -f /tmp/nextjs-source.zip
  (cd ${PROJECT_ROOT}/docker/nextjs && zip -qr /tmp/nextjs-source.zip . -x 'node_modules/*' '.next/*' 'out/*' '*.backup*' '*.bak*' 'tsconfig.tsbuildinfo')
  aws s3 cp /tmp/nextjs-source.zip s3://${DATA_BUCKET}/codebuild/nextjs-source.zip --region $REGION
  echo "  ✅ Source uploaded to S3"

  # CodeBuild IAMロール作成
  aws iam create-role --role-name webapp-codebuild-role \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"codebuild.amazonaws.com"},"Action":"sts:AssumeRole"}]}' 2>/dev/null || true
  aws iam attach-role-policy --role-name webapp-codebuild-role --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser 2>/dev/null || true
  aws iam attach-role-policy --role-name webapp-codebuild-role --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess 2>/dev/null || true
  aws iam attach-role-policy --role-name webapp-codebuild-role --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess 2>/dev/null || true
  sleep 10  # IAMロール伝播待ち

  # CodeBuildプロジェクト作成
  aws codebuild create-project --name webapp-docker-build \
    --source "{\"type\":\"S3\",\"location\":\"${DATA_BUCKET}/codebuild/nextjs-source.zip\"}" \
    --artifacts '{"type":"NO_ARTIFACTS"}' \
    --environment '{"type":"LINUX_CONTAINER","image":"aws/codebuild/standard:7.0","computeType":"BUILD_GENERAL1_MEDIUM","privilegedMode":true}' \
    --service-role "arn:aws:iam::${ACCOUNT_ID}:role/webapp-codebuild-role" \
    --region $REGION 2>/dev/null || \
  aws codebuild update-project --name webapp-docker-build \
    --source "{\"type\":\"S3\",\"location\":\"${DATA_BUCKET}/codebuild/nextjs-source.zip\"}" \
    --region $REGION 2>/dev/null

  # ビルド実行
  IMAGE_TAG="initial-$(date +%Y%m%d-%H%M%S)"
  BUILD_ID=$(aws codebuild start-build --project-name webapp-docker-build \
    --buildspec-override "version: 0.2
phases:
  pre_build:
    commands:
      - aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com
      - ECR_URI=${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}
  build:
    commands:
      - docker build --no-cache -t \${ECR_URI}:${IMAGE_TAG} -f Dockerfile .
      - docker tag \${ECR_URI}:${IMAGE_TAG} \${ECR_URI}:latest
  post_build:
    commands:
      - docker push \${ECR_URI}:${IMAGE_TAG}
      - docker push \${ECR_URI}:latest" \
    --region $REGION --query 'build.id' --output text)

  echo "  ⏳ CodeBuild running: $BUILD_ID"
  for i in $(seq 1 30); do
    sleep 30
    S=$(aws codebuild batch-get-builds --ids $BUILD_ID --region $REGION --query 'builds[0].buildStatus' --output text)
    echo "    [$i] $S"
    if [ "$S" = "SUCCEEDED" ]; then echo "  ✅ Image built and pushed: ${IMAGE_TAG}"; break; fi
    if [ "$S" = "FAILED" ]; then echo "  ❌ Build failed"; exit 1; fi
  done
fi

echo ""
echo "============================================"
echo "  ✅ プリデプロイセットアップ完了"
echo "============================================"
echo ""
echo "  ECR: ${ECR_URI}:latest"
echo ""
echo "  次のステップ:"
echo "    npx cdk deploy --all --app 'npx ts-node bin/demo-app.ts' \\"
echo "      -c enableAgent=true --require-approval never"
