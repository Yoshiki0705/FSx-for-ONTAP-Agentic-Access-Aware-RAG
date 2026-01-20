#!/bin/bash
set -euo pipefail

# Phase 2.2 Middleware Fix Deployment Script
# Purpose: Add /config to publicPaths in middleware.ts to allow config files access
# Date: 2026-01-20

# ============================================================================
# Configuration
# ============================================================================

EC2_HOST="3.112.214.40"
SSH_KEY="/Users/yoshiki/Downloads/Archive/system-files/fujiwara-useast1.pem"
SSH_OPTIONS="-o StrictHostKeyChecking=no -o PubkeyAcceptedAlgorithms=+ssh-rsa -o HostKeyAlgorithms=+ssh-rsa"
PROJECT_DIR="/home/ubuntu/Permission-aware-RAG-FSxN-CDK-github"
ECR_REGISTRY="178625946981.dkr.ecr.ap-northeast-1.amazonaws.com"
ECR_REPO="tokyoregion-permission-aware-rag-prod-webapp-repo"
FUNCTION_NAME="TokyoRegion-permission-aware-rag-prod-WebApp-Function"
DISTRIBUTION_ID="E2OQCNTHSUDXYB"
REGION="ap-northeast-1"

# Image tag with timestamp
IMAGE_TAG="phase2-2-middleware-fix-$(date +%Y%m%d-%H%M%S)"

echo "============================================================================"
echo "Phase 2.2 Middleware Fix Deployment"
echo "============================================================================"
echo "Image Tag: $IMAGE_TAG"
echo "EC2 Host: $EC2_HOST"
echo "Project Dir: $PROJECT_DIR"
echo ""

# ============================================================================
# Step 1: Sync middleware.ts to EC2
# ============================================================================

echo "============================================================================"
echo "Step 1: Syncing middleware.ts to EC2..."
echo "============================================================================"

rsync -avz --progress \
  -e "ssh -i $SSH_KEY $SSH_OPTIONS" \
  docker/nextjs/src/middleware.ts \
  ubuntu@$EC2_HOST:$PROJECT_DIR/docker/nextjs/src/middleware.ts

if [ $? -eq 0 ]; then
  echo "✅ middleware.ts synced successfully"
else
  echo "❌ Failed to sync middleware.ts"
  exit 1
fi

echo ""

# ============================================================================
# Step 2: Clean Build on EC2
# ============================================================================

echo "============================================================================"
echo "Step 2: Clean Build on EC2..."
echo "============================================================================"

ssh -i "$SSH_KEY" $SSH_OPTIONS ubuntu@$EC2_HOST << 'ENDSSH'
set -euo pipefail

cd /home/ubuntu/Permission-aware-RAG-FSxN-CDK-github/docker/nextjs

echo "🧹 Cleaning cache..."
rm -rf .next node_modules/.cache
npm cache clean --force

echo "🔨 Building Next.js application..."
NODE_ENV=production npm run build

if [ $? -eq 0 ]; then
  echo "✅ Build completed successfully"
else
  echo "❌ Build failed"
  exit 1
fi
ENDSSH

if [ $? -eq 0 ]; then
  echo "✅ Clean build completed on EC2"
else
  echo "❌ Clean build failed on EC2"
  exit 1
fi

echo ""

# ============================================================================
# Step 3: Docker Build on EC2
# ============================================================================

echo "============================================================================"
echo "Step 3: Docker Build on EC2..."
echo "============================================================================"

ssh -i "$SSH_KEY" $SSH_OPTIONS ubuntu@$EC2_HOST << ENDSSH
set -euo pipefail

cd /home/ubuntu/Permission-aware-RAG-FSxN-CDK-github/docker/nextjs

echo "🐳 Building Docker image..."
docker build --no-cache --pull \
  -t permission-aware-rag-webapp:$IMAGE_TAG \
  -f Dockerfile \
  .

if [ \$? -eq 0 ]; then
  echo "✅ Docker image built successfully"
else
  echo "❌ Docker build failed"
  exit 1
fi
ENDSSH

if [ $? -eq 0 ]; then
  echo "✅ Docker image built on EC2"
else
  echo "❌ Docker build failed on EC2"
  exit 1
fi

echo ""

# ============================================================================
# Step 4: Docker Image Verification on EC2
# ============================================================================

echo "============================================================================"
echo "Step 4: Docker Image Verification on EC2..."
echo "============================================================================"

ssh -i "$SSH_KEY" $SSH_OPTIONS ubuntu@$EC2_HOST << ENDSSH
set -euo pipefail

cd /home/ubuntu/Permission-aware-RAG-FSxN-CDK-github

echo "🔍 Verifying Docker image..."

# Check 1: Image exists
if docker image inspect permission-aware-rag-webapp:$IMAGE_TAG > /dev/null 2>&1; then
  echo "✅ 1/6: Image exists"
else
  echo "❌ 1/6: Image does not exist"
  exit 1
fi

# Check 2: /app/server.js exists
if docker run --rm --entrypoint ls permission-aware-rag-webapp:$IMAGE_TAG /app/server.js > /dev/null 2>&1; then
  echo "✅ 2/6: /app/server.js exists"
else
  echo "❌ 2/6: /app/server.js does not exist"
  exit 1
fi

# Check 3: /app/.next exists
if docker run --rm --entrypoint ls permission-aware-rag-webapp:$IMAGE_TAG -d /app/.next > /dev/null 2>&1; then
  echo "✅ 3/6: /app/.next exists"
else
  echo "❌ 3/6: /app/.next does not exist"
  exit 1
fi

# Check 4: /app/package.json exists
if docker run --rm --entrypoint ls permission-aware-rag-webapp:$IMAGE_TAG /app/package.json > /dev/null 2>&1; then
  echo "✅ 4/6: /app/package.json exists"
else
  echo "❌ 4/6: /app/package.json does not exist"
  exit 1
fi

# Check 5: /app/.next/static exists
if docker run --rm --entrypoint ls permission-aware-rag-webapp:$IMAGE_TAG -d /app/.next/static > /dev/null 2>&1; then
  echo "✅ 5/6: /app/.next/static exists"
else
  echo "❌ 5/6: /app/.next/static does not exist"
  exit 1
fi

# Check 6: Config files exist in public folder
if docker run --rm --entrypoint ls permission-aware-rag-webapp:$IMAGE_TAG /app/public/config/agent-regions.json > /dev/null 2>&1; then
  echo "✅ 6/6: Config files exist in public folder"
else
  echo "❌ 6/6: Config files do not exist in public folder"
  exit 1
fi

echo "✅ All verification checks passed (6/6)"
ENDSSH

if [ $? -eq 0 ]; then
  echo "✅ Docker image verification passed"
else
  echo "❌ Docker image verification failed"
  exit 1
fi

echo ""

# ============================================================================
# Step 5: ECR Push from EC2
# ============================================================================

echo "============================================================================"
echo "Step 5: ECR Push from EC2..."
echo "============================================================================"

ssh -i "$SSH_KEY" $SSH_OPTIONS ubuntu@$EC2_HOST << ENDSSH
set -euo pipefail

echo "🔐 ECR Login..."
aws ecr get-login-password --region $REGION | \
  docker login --username AWS --password-stdin $ECR_REGISTRY

echo "🏷️ Tagging image..."
docker tag permission-aware-rag-webapp:$IMAGE_TAG \
  $ECR_REGISTRY/$ECR_REPO:$IMAGE_TAG

echo "📤 Pushing to ECR..."
docker push $ECR_REGISTRY/$ECR_REPO:$IMAGE_TAG

if [ \$? -eq 0 ]; then
  echo "✅ Image pushed to ECR successfully"
else
  echo "❌ ECR push failed"
  exit 1
fi
ENDSSH

if [ $? -eq 0 ]; then
  echo "✅ ECR push completed"
else
  echo "❌ ECR push failed"
  exit 1
fi

echo ""

# ============================================================================
# Step 6: Lambda Function Update
# ============================================================================

echo "============================================================================"
echo "Step 6: Lambda Function Update..."
echo "============================================================================"

aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --image-uri "$ECR_REGISTRY/$ECR_REPO:$IMAGE_TAG"

if [ $? -eq 0 ]; then
  echo "✅ Lambda function updated successfully"
else
  echo "❌ Lambda function update failed"
  exit 1
fi

echo ""

# ============================================================================
# Step 7: Container Refresh v12 (Environment Variable Update Method)
# ============================================================================

echo "============================================================================"
echo "Step 7: Container Refresh v12..."
echo "============================================================================"

echo "7.1: Updating environment variable to invalidate container cache..."
REFRESH_TIMESTAMP=$(date +%s)
aws lambda update-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --environment "Variables={FORCE_CONTAINER_REFRESH=$REFRESH_TIMESTAMP}" \
  > /dev/null 2>&1

echo "⏳ Waiting 30 seconds for environment variable update..."
sleep 30

echo "7.2: Setting Reserved Concurrency to 0..."
aws lambda put-function-concurrency \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --reserved-concurrent-executions 0 \
  > /dev/null 2>&1

echo "⏳ Waiting 15 seconds..."
sleep 15

echo "7.3: Deleting Reserved Concurrency..."
aws lambda delete-function-concurrency \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  > /dev/null 2>&1

echo "7.4: Warming up Lambda function (30 invocations)..."
for i in {1..30}; do
  aws lambda invoke \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --payload '{"rawPath": "/health", "requestContext": {"http": {"method": "GET"}}}' \
    --cli-binary-format raw-in-base64-out \
    /tmp/lambda-response-$i.json > /dev/null 2>&1
  echo "  [$i/30] Invocation completed"
  sleep 1
done

echo "✅ Container Refresh v12 completed"

echo ""

# ============================================================================
# Step 8: CloudFront Cache Invalidation
# ============================================================================

echo "============================================================================"
echo "Step 8: CloudFront Cache Invalidation..."
echo "============================================================================"

aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" "/ja/*" "/en/*" "/ko/*" "/config/*"

if [ $? -eq 0 ]; then
  echo "✅ CloudFront cache invalidated successfully"
else
  echo "❌ CloudFront cache invalidation failed"
  exit 1
fi

echo ""

# ============================================================================
# Deployment Summary
# ============================================================================

echo "============================================================================"
echo "✅ Phase 2.2 Middleware Fix Deployment Completed Successfully!"
echo "============================================================================"
echo "Image Tag: $IMAGE_TAG"
echo "ECR URI: $ECR_REGISTRY/$ECR_REPO:$IMAGE_TAG"
echo "Lambda Function: $FUNCTION_NAME"
echo "CloudFront Distribution: $DISTRIBUTION_ID"
echo ""
echo "Next Steps:"
echo "1. Wait 2-3 minutes for CloudFront cache to clear"
echo "2. Access: https://d3dtbzb01ax74x.cloudfront.net/ja/genai?mode=agent"
echo "3. Verify config files are accessible:"
echo "   - https://d3dtbzb01ax74x.cloudfront.net/config/agent-regions.json"
echo "   - https://d3dtbzb01ax74x.cloudfront.net/config/kb-regions.json"
echo "4. Check console logs for successful config file loading"
echo "5. Verify Region Selector shows '✅ 7モデル利用可能' (not 14)"
echo "============================================================================"
