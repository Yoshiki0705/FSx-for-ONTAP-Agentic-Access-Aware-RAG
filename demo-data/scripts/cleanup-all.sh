#!/bin/bash
set -euo pipefail
#
# Permission-aware RAG 環境 完全クリーンアップスクリプト
#
# CDKスタック + 手動作成リソースを全て削除します。
#
# 使用方法:
#   bash demo-data/scripts/cleanup-all.sh

REGION="${AWS_REGION:-ap-northeast-1}"
STACK_PREFIX="${STACK_PREFIX:-perm-rag-demo-demo}"

echo "============================================"
echo "  環境クリーンアップ"
echo "============================================"
echo "  Region: $REGION"
echo "  Stack: $STACK_PREFIX"
echo ""

# ========================================
# 1. 手動作成リソースの削除
# ========================================
echo "🧹 Step 1: 手動作成リソースの削除..."

# S3 Access Point
S3AP_NAME="${STACK_PREFIX}-s3ap"
aws fsx detach-and-delete-s3-access-point --name "$S3AP_NAME" --region $REGION 2>/dev/null && echo "  ✅ S3 AP: $S3AP_NAME" || echo "  ⏭️ S3 AP: not found"

# ECRリポジトリ
aws ecr delete-repository --repository-name permission-aware-rag-webapp --force --region $REGION 2>/dev/null && echo "  ✅ ECR: permission-aware-rag-webapp" || echo "  ⏭️ ECR: not found"

# CodeBuildプロジェクト + IAMロール
aws codebuild delete-project --name webapp-docker-build --region $REGION 2>/dev/null && echo "  ✅ CodeBuild: webapp-docker-build" || echo "  ⏭️ CodeBuild: not found"
for POLICY in $(aws iam list-attached-role-policies --role-name webapp-codebuild-role --query 'AttachedPolicies[].PolicyArn' --output text 2>/dev/null); do
  aws iam detach-role-policy --role-name webapp-codebuild-role --policy-arn "$POLICY" 2>/dev/null
done
aws iam delete-role --role-name webapp-codebuild-role 2>/dev/null && echo "  ✅ IAM: webapp-codebuild-role" || echo "  ⏭️ IAM: not found"

sleep 30
echo ""

# ========================================
# 2. Embeddingスタック削除（存在する場合）
# ========================================
echo "🧹 Step 2: Embeddingスタック削除..."
aws cloudformation delete-stack --stack-name ${STACK_PREFIX}-Embedding --region $REGION 2>/dev/null
aws cloudformation wait stack-delete-complete --stack-name ${STACK_PREFIX}-Embedding --region $REGION 2>/dev/null && echo "  ✅ Embedding deleted" || echo "  ⏭️ Embedding: not found"
echo ""

# ========================================
# 3. CDK destroy
# ========================================
echo "🧹 Step 3: CDK destroy..."
npx cdk destroy --all --app "npx ts-node bin/demo-app.ts" --force 2>&1 || true
echo ""

# ========================================
# 4. 残留スタックの個別削除
# ========================================
echo "🧹 Step 4: 残留スタック確認..."
for S in WebApp AI Storage Security Networking; do
  STATUS=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-${S} --region $REGION --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "DELETED")
  if [ "$STATUS" != "DELETED" ] && [ "$STATUS" != "DELETE_COMPLETE" ]; then
    echo "  $S: $STATUS → 削除中..."
    aws cloudformation delete-stack --stack-name ${STACK_PREFIX}-${S} --region $REGION 2>/dev/null
    aws cloudformation wait stack-delete-complete --stack-name ${STACK_PREFIX}-${S} --region $REGION 2>/dev/null && echo "  ✅ $S deleted" || echo "  ❌ $S deletion failed"
  fi
done

# Waf (us-east-1)
WAF_STATUS=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Waf --region us-east-1 --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "DELETED")
if [ "$WAF_STATUS" != "DELETED" ] && [ "$WAF_STATUS" != "DELETE_COMPLETE" ]; then
  echo "  Waf: $WAF_STATUS → 削除中..."
  aws cloudformation delete-stack --stack-name ${STACK_PREFIX}-Waf --region us-east-1 2>/dev/null
  aws cloudformation wait stack-delete-complete --stack-name ${STACK_PREFIX}-Waf --region us-east-1 2>/dev/null && echo "  ✅ Waf deleted" || echo "  ❌ Waf deletion failed"
fi
echo ""

# ========================================
# 5. 孤立AD SG削除
# ========================================
echo "🧹 Step 5: 孤立リソース確認..."
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=tag:Name,Values=*perm-rag*" --region $REGION --query 'Vpcs[0].VpcId' --output text 2>/dev/null || echo "")
if [ -n "$VPC_ID" ] && [ "$VPC_ID" != "None" ]; then
  for SG_ID in $(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" "Name=group-name,Values=d-*_controllers" --region $REGION --query 'SecurityGroups[].GroupId' --output text 2>/dev/null); do
    aws ec2 delete-security-group --group-id $SG_ID --region $REGION 2>/dev/null && echo "  ✅ Orphan SG: $SG_ID deleted"
  done
  # Networkingスタック再削除
  aws cloudformation delete-stack --stack-name ${STACK_PREFIX}-Networking --region $REGION 2>/dev/null
  aws cloudformation wait stack-delete-complete --stack-name ${STACK_PREFIX}-Networking --region $REGION 2>/dev/null
fi
echo ""

# ========================================
# 最終確認
# ========================================
echo "============================================"
echo "  最終確認"
echo "============================================"
ALL_CLEAN=true
for S in Embedding WebApp AI Storage Security Networking; do
  STATUS=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-${S} --region $REGION --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "DELETED")
  if [ "$STATUS" = "DELETED" ] || [ "$STATUS" = "DELETE_COMPLETE" ]; then
    echo "  ✅ $S: DELETED"
  else
    echo "  ❌ $S: $STATUS"
    ALL_CLEAN=false
  fi
done
WAF_STATUS=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Waf --region us-east-1 --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "DELETED")
if [ "$WAF_STATUS" = "DELETED" ] || [ "$WAF_STATUS" = "DELETE_COMPLETE" ]; then
  echo "  ✅ Waf: DELETED"
else
  echo "  ❌ Waf: $WAF_STATUS"
  ALL_CLEAN=false
fi

echo ""
if [ "$ALL_CLEAN" = true ]; then
  echo "✅ 全リソース削除完了"
else
  echo "⚠️ 一部リソースが残っています。手動確認が必要です。"
fi
