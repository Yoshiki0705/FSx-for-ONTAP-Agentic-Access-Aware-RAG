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

# CodeBuild S3バケット
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
CODEBUILD_BUCKET="perm-rag-codebuild-${ACCOUNT_ID}"
aws s3 rb "s3://${CODEBUILD_BUCKET}" --force --region $REGION 2>/dev/null && echo "  ✅ S3: ${CODEBUILD_BUCKET}" || echo "  ⏭️ S3: ${CODEBUILD_BUCKET} not found"

sleep 30
echo ""

# ========================================
# 2. Bedrock KBデータソース削除（CDK destroy前に必須）
# ========================================
echo "🧹 Step 2: Bedrock KBデータソース削除..."
KB_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-AI --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text 2>/dev/null || echo "")
if [ -n "$KB_ID" ] && [ "$KB_ID" != "None" ] && [ "$KB_ID" != "" ]; then
  DS_IDS=$(aws bedrock-agent list-data-sources --knowledge-base-id $KB_ID --region $REGION \
    --query 'dataSourceSummaries[].dataSourceId' --output text 2>/dev/null || echo "")
  for DS_ID in $DS_IDS; do
    aws bedrock-agent delete-data-source --knowledge-base-id $KB_ID --data-source-id $DS_ID --region $REGION 2>/dev/null \
      && echo "  ✅ KB DataSource: $DS_ID" || echo "  ⏭️ KB DataSource: $DS_ID not found"
  done
  [ -z "$DS_IDS" ] && echo "  ⏭️ No data sources found"
  sleep 10
else
  echo "  ⏭️ KB not found"
fi
echo ""

# ========================================
# 3. 動的作成されたBedrock Agents削除
# ========================================
echo "🧹 Step 3: 動的作成Bedrock Agents削除..."
CDK_AGENT_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-AI --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentId`].OutputValue' --output text 2>/dev/null || echo "")
AGENT_IDS=$(aws bedrock-agent list-agents --region $REGION \
  --query 'agentSummaries[].agentId' --output text 2>/dev/null || echo "")
DELETED_COUNT=0
for AGENT_ID in $AGENT_IDS; do
  if [ "$AGENT_ID" = "$CDK_AGENT_ID" ]; then
    echo "  ⏭️ CDK-managed agent: $AGENT_ID (CDK destroyで削除)"
    continue
  fi
  aws bedrock-agent delete-agent --agent-id $AGENT_ID --skip-resource-in-use-check --region $REGION 2>/dev/null \
    && echo "  ✅ Agent: $AGENT_ID" && DELETED_COUNT=$((DELETED_COUNT + 1)) || echo "  ⏭️ Agent: $AGENT_ID not found"
done
[ $DELETED_COUNT -eq 0 ] && echo "  ⏭️ No dynamic agents found"
echo ""

# ========================================
# 3.5. エンタープライズAgent機能リソース削除
# ========================================
echo "🧹 Step 3.5: エンタープライズAgent機能リソース削除..."

# EventBridge Schedulerグループ内のスケジュール削除
SCHEDULES=$(aws scheduler list-schedules --group-name agent-schedules --region $REGION --query 'Schedules[].Name' --output text 2>/dev/null || echo "")
for SCHED in $SCHEDULES; do
  aws scheduler delete-schedule --name "$SCHED" --group-name agent-schedules --region $REGION 2>/dev/null \
    && echo "  ✅ Schedule: $SCHED" || echo "  ⏭️ Schedule: $SCHED not found"
done
# EventBridge Schedulerグループ削除
aws scheduler delete-schedule-group --name agent-schedules --region $REGION 2>/dev/null \
  && echo "  ✅ Scheduler Group: agent-schedules" || echo "  ⏭️ Scheduler Group: not found"

# S3共有Agentバケット（CDK AutoDeleteObjectsで自動削除されるが念のため）
SHARED_BUCKET="${STACK_PREFIX}-shared-agents"
aws s3 rb "s3://${SHARED_BUCKET}" --force --region $REGION 2>/dev/null \
  && echo "  ✅ S3: ${SHARED_BUCKET}" || echo "  ⏭️ S3: ${SHARED_BUCKET} not found"

echo ""

# ========================================
# 4. Embeddingスタック削除（存在する場合）
# ========================================
echo "🧹 Step 4: Embeddingスタック削除..."
aws cloudformation delete-stack --stack-name ${STACK_PREFIX}-Embedding --region $REGION 2>/dev/null
aws cloudformation wait stack-delete-complete --stack-name ${STACK_PREFIX}-Embedding --region $REGION 2>/dev/null && echo "  ✅ Embedding deleted" || echo "  ⏭️ Embedding: not found"
echo ""

# ========================================
# 5. CDK destroy
# ========================================
echo "🧹 Step 5: CDK destroy..."
npx cdk destroy --all --app "npx ts-node bin/demo-app.ts" --force 2>&1 || true
echo ""

# ========================================
# 6. 残留スタックの個別削除
# ========================================
echo "🧹 Step 6: 残留スタック確認..."
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
# 7. 孤立AD SG削除
# ========================================
echo "🧹 Step 7: 孤立リソース確認..."
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
# 7.5. OpenLDAP EC2 + IAMリソース削除
# ========================================
echo "🧹 Step 7.5: OpenLDAP関連リソース削除..."

# OpenLDAP EC2インスタンス削除
LDAP_EC2=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=${STACK_PREFIX}-openldap" "Name=instance-state-name,Values=running,stopped" \
  --region $REGION --query 'Reservations[0].Instances[0].InstanceId' --output text 2>/dev/null || echo "None")
if [ "$LDAP_EC2" != "None" ] && [ -n "$LDAP_EC2" ]; then
  aws ec2 terminate-instances --instance-ids "$LDAP_EC2" --region $REGION 2>/dev/null
  echo "  ✅ OpenLDAP EC2: $LDAP_EC2 terminating"
  aws ec2 wait instance-terminated --instance-ids "$LDAP_EC2" --region $REGION 2>/dev/null || true
fi

# OpenLDAP IAMインスタンスプロファイル + ロール削除
PROFILE_NAME="${STACK_PREFIX}-openldap-profile"
ROLE_NAME="${STACK_PREFIX}-openldap-role"
aws iam remove-role-from-instance-profile --instance-profile-name "$PROFILE_NAME" --role-name "$ROLE_NAME" 2>/dev/null || true
aws iam delete-instance-profile --instance-profile-name "$PROFILE_NAME" 2>/dev/null && echo "  ✅ IAM Profile: $PROFILE_NAME" || true
aws iam detach-role-policy --role-name "$ROLE_NAME" --policy-arn "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore" 2>/dev/null || true
aws iam delete-role --role-name "$ROLE_NAME" 2>/dev/null && echo "  ✅ IAM Role: $ROLE_NAME" || true

# OpenLDAP セキュリティグループ削除
LDAP_SG=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=${STACK_PREFIX}-openldap-sg" --region $REGION --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo "None")
if [ "$LDAP_SG" != "None" ] && [ -n "$LDAP_SG" ]; then
  aws ec2 delete-security-group --group-id "$LDAP_SG" --region $REGION 2>/dev/null && echo "  ✅ SG: $LDAP_SG" || echo "  ⏭️ SG: in use (will be deleted with VPC)"
fi

# Secrets Manager シークレット削除（LDAP + ONTAP）
for SECRET in ldap-bind-password ontap-fsxadmin-password; do
  aws secretsmanager delete-secret --secret-id "$SECRET" --force-delete-without-recovery --region $REGION 2>/dev/null && echo "  ✅ Secret: $SECRET" || true
done

echo ""

# ========================================
# 7.6. VPC内の残留EC2インスタンス削除
# ========================================
echo "🧹 Step 7.6: VPC内残留EC2確認..."
if [ -n "$VPC_ID" ] && [ "$VPC_ID" != "None" ]; then
  EC2_IDS=$(aws ec2 describe-instances --filters "Name=vpc-id,Values=$VPC_ID" "Name=instance-state-name,Values=running,stopped" \
    --region $REGION --query 'Reservations[].Instances[].InstanceId' --output text 2>/dev/null || echo "")
  for EC2_ID in $EC2_IDS; do
    echo "  Terminating: $EC2_ID"
    aws ec2 terminate-instances --instance-ids $EC2_ID --region $REGION 2>/dev/null
    aws ec2 wait instance-terminated --instance-ids $EC2_ID --region $REGION 2>/dev/null && echo "  ✅ $EC2_ID terminated"
  done
  # 残留SG削除（default以外）
  for SG_ID in $(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" --region $REGION \
    --query 'SecurityGroups[?GroupName!=`default`].GroupId' --output text 2>/dev/null); do
    aws ec2 delete-security-group --group-id $SG_ID --region $REGION 2>/dev/null && echo "  ✅ SG: $SG_ID deleted"
  done
  # Networkingスタック再削除（EC2/SG削除後）
  NET_STATUS=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Networking --region $REGION --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "DELETED")
  if [ "$NET_STATUS" = "DELETE_FAILED" ]; then
    echo "  Retrying Networking stack deletion..."
    aws cloudformation delete-stack --stack-name ${STACK_PREFIX}-Networking --region $REGION 2>/dev/null
    aws cloudformation wait stack-delete-complete --stack-name ${STACK_PREFIX}-Networking --region $REGION 2>/dev/null && echo "  ✅ Networking deleted"
  fi
fi
echo ""

# ========================================
# 8. CDKToolkit + staging S3バケット削除
# ========================================
echo "🧹 Step 8: CDKToolkit削除..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

for CDK_REGION in $REGION us-east-1; do
  CDK_STATUS=$(aws cloudformation describe-stacks --stack-name CDKToolkit --region $CDK_REGION --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "DELETED")
  if [ "$CDK_STATUS" != "DELETED" ] && [ "$CDK_STATUS" != "DELETE_COMPLETE" ]; then
    # ECRリポジトリ削除
    aws ecr delete-repository --repository-name "cdk-hnb659fds-container-assets-${ACCOUNT_ID}-${CDK_REGION}" --force --region $CDK_REGION 2>/dev/null && echo "  ✅ CDK ECR ($CDK_REGION) deleted" || true
    # CDKToolkitスタック削除
    aws cloudformation delete-stack --stack-name CDKToolkit --region $CDK_REGION 2>/dev/null
    aws cloudformation wait stack-delete-complete --stack-name CDKToolkit --region $CDK_REGION 2>/dev/null && echo "  ✅ CDKToolkit ($CDK_REGION) deleted" || echo "  ⏭️ CDKToolkit ($CDK_REGION) not found"
    # S3 stagingバケット削除（バージョニング対応）
    CDK_BUCKET="cdk-hnb659fds-assets-${ACCOUNT_ID}-${CDK_REGION}"
    if aws s3api head-bucket --bucket "$CDK_BUCKET" 2>/dev/null; then
      aws s3api list-object-versions --bucket "$CDK_BUCKET" --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}' --output json 2>/dev/null | aws s3api delete-objects --bucket "$CDK_BUCKET" --delete file:///dev/stdin 2>/dev/null
      aws s3api list-object-versions --bucket "$CDK_BUCKET" --query '{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}' --output json 2>/dev/null | aws s3api delete-objects --bucket "$CDK_BUCKET" --delete file:///dev/stdin 2>/dev/null
      aws s3api delete-bucket --bucket "$CDK_BUCKET" 2>/dev/null && echo "  ✅ CDK S3 ($CDK_REGION) deleted"
    fi
  else
    echo "  ⏭️ CDKToolkit ($CDK_REGION): already deleted"
  fi
done
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

# CDKToolkit確認
for CDK_REGION in $REGION us-east-1; do
  CDK_STATUS=$(aws cloudformation describe-stacks --stack-name CDKToolkit --region $CDK_REGION --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "DELETED")
  if [ "$CDK_STATUS" = "DELETED" ] || [ "$CDK_STATUS" = "DELETE_COMPLETE" ]; then
    echo "  ✅ CDKToolkit ($CDK_REGION): DELETED"
  else
    echo "  ⚠️ CDKToolkit ($CDK_REGION): $CDK_STATUS"
  fi
done
