#!/bin/bash
set -euo pipefail
#
# Permission-aware RAG 環境 完全クリーンアップスクリプト
#
# CDKスタック + 手動作成リソース + 孤立リソースを全て削除します。
#
# 使用方法:
#   bash demo-data/scripts/cleanup-all.sh              # 通常実行（確認プロンプトあり）
#   bash demo-data/scripts/cleanup-all.sh --force       # 確認なしで実行
#   bash demo-data/scripts/cleanup-all.sh --dry-run     # 削除せずに対象リソースを表示
#
# 環境変数:
#   AWS_REGION     - AWSリージョン（デフォルト: ap-northeast-1）
#   STACK_PREFIX   - スタック名プレフィックス（デフォルト: perm-rag-demo-demo）

REGION="${AWS_REGION:-ap-northeast-1}"
STACK_PREFIX="${STACK_PREFIX:-perm-rag-demo-demo}"
DRY_RUN=false
FORCE=false
ERRORS=()

for arg in "$@"; do
  case $arg in
    --dry-run) DRY_RUN=true ;;
    --force)   FORCE=true ;;
  esac
done

# ========================================
# ユーティリティ関数
# ========================================
ok()   { echo "  ✅ $1"; }
skip() { echo "  ⏭️  $1"; }
fail() { echo "  ❌ $1"; ERRORS+=("$1"); }
info() { echo "  ℹ️  $1"; }
dry()  { echo "  🔍 [dry-run] $1"; }

run_or_dry() {
  if [ "$DRY_RUN" = true ]; then
    dry "$1"
  else
    eval "$2" && ok "$1" || skip "$1"
  fi
}

wait_seconds() {
  if [ "$DRY_RUN" = false ]; then
    echo "  ⏳ ${1}秒待機中..."
    sleep "$1"
  fi
}

echo "============================================"
echo "  Permission-aware RAG 環境クリーンアップ"
echo "============================================"
echo "  Region:     $REGION"
echo "  Stack:      $STACK_PREFIX"
echo "  Dry Run:    $DRY_RUN"
echo "  Force:      $FORCE"
echo ""

if [ "$DRY_RUN" = false ] && [ "$FORCE" = false ]; then
  echo "⚠️  この操作は全てのAWSリソースを削除します。元に戻せません。"
  read -p "続行しますか？ (yes/no): " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "キャンセルしました。"
    exit 0
  fi
  echo ""
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# ========================================
# 1. 手動作成リソースの削除
# ========================================
echo "🧹 Step 1/10: 手動作成リソースの削除..."

# S3 Access Point
S3AP_NAME="${STACK_PREFIX}-s3ap"
run_or_dry "S3 AP: $S3AP_NAME" \
  "aws fsx detach-and-delete-s3-access-point --name '$S3AP_NAME' --region $REGION 2>/dev/null"

# ECRリポジトリ
run_or_dry "ECR: permission-aware-rag-webapp" \
  "aws ecr delete-repository --repository-name permission-aware-rag-webapp --force --region $REGION 2>/dev/null"

# CodeBuildプロジェクト + IAMロール
run_or_dry "CodeBuild: webapp-docker-build" \
  "aws codebuild delete-project --name webapp-docker-build --region $REGION 2>/dev/null"
if [ "$DRY_RUN" = false ]; then
  for POLICY in $(aws iam list-attached-role-policies --role-name webapp-codebuild-role --query 'AttachedPolicies[].PolicyArn' --output text 2>/dev/null); do
    aws iam detach-role-policy --role-name webapp-codebuild-role --policy-arn "$POLICY" 2>/dev/null || true
  done
fi
run_or_dry "IAM: webapp-codebuild-role" \
  "aws iam delete-role --role-name webapp-codebuild-role 2>/dev/null"

# CodeBuild S3バケット
CODEBUILD_BUCKET="perm-rag-codebuild-${ACCOUNT_ID}"
run_or_dry "S3: ${CODEBUILD_BUCKET}" \
  "aws s3 rb 's3://${CODEBUILD_BUCKET}' --force --region $REGION 2>/dev/null"

wait_seconds 10
echo ""

# ========================================
# 2. Bedrock KBデータソース削除（CDK destroy前に必須）
# ========================================
echo "🧹 Step 2/10: Bedrock KBデータソース削除..."

# CDK管理KBのデータソース削除
KB_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-AI --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text 2>/dev/null || echo "")

# データソース削除関数（RETAIN フォールバック付き）
delete_kb_datasources() {
  local kb_id="$1"
  local ds_ids
  ds_ids=$(aws bedrock-agent list-data-sources --knowledge-base-id "$kb_id" --region $REGION \
    --query 'dataSourceSummaries[].dataSourceId' --output text 2>/dev/null || echo "")
  [ -z "$ds_ids" ] && return 0

  for ds_id in $ds_ids; do
    info "データソース削除中: $ds_id (KB: $kb_id)"
    aws bedrock-agent delete-data-source --knowledge-base-id "$kb_id" --data-source-id "$ds_id" --region $REGION 2>/dev/null || true
    sleep 15

    # 削除結果を確認
    local status
    status=$(aws bedrock-agent get-data-source --knowledge-base-id "$kb_id" --data-source-id "$ds_id" --region $REGION \
      --query 'dataSource.status' --output text 2>/dev/null || echo "DELETED")

    if [ "$status" = "DELETE_UNSUCCESSFUL" ]; then
      info "DELETE_UNSUCCESSFUL → dataDeletionPolicy を RETAIN に変更して再試行..."
      # 現在の設定を取得
      local ds_name ds_config
      ds_name=$(aws bedrock-agent get-data-source --knowledge-base-id "$kb_id" --data-source-id "$ds_id" --region $REGION \
        --query 'dataSource.name' --output text 2>/dev/null)
      ds_config=$(aws bedrock-agent get-data-source --knowledge-base-id "$kb_id" --data-source-id "$ds_id" --region $REGION \
        --query 'dataSource.dataSourceConfiguration' --output json 2>/dev/null)

      # RETAIN に変更
      aws bedrock-agent update-data-source \
        --knowledge-base-id "$kb_id" --data-source-id "$ds_id" \
        --name "$ds_name" --data-deletion-policy "RETAIN" \
        --data-source-configuration "$ds_config" \
        --region $REGION 2>/dev/null || true
      sleep 3

      # 再削除
      aws bedrock-agent delete-data-source --knowledge-base-id "$kb_id" --data-source-id "$ds_id" --region $REGION 2>/dev/null || true
      sleep 15

      # 最終確認
      local final_status
      final_status=$(aws bedrock-agent get-data-source --knowledge-base-id "$kb_id" --data-source-id "$ds_id" --region $REGION \
        --query 'dataSource.status' --output text 2>/dev/null || echo "DELETED")
      if [ "$final_status" = "DELETED" ] || [ "$final_status" = "" ]; then
        ok "データソース $ds_id (RETAIN フォールバック)"
      else
        fail "データソース $ds_id: $final_status"
      fi
    elif [ "$status" = "DELETED" ] || [ "$status" = "" ]; then
      ok "データソース $ds_id"
    else
      info "データソース $ds_id: $status (削除進行中)"
    fi
  done
}

if [ -n "$KB_ID" ] && [ "$KB_ID" != "None" ] && [ "$KB_ID" != "" ]; then
  if [ "$DRY_RUN" = true ]; then
    dry "CDK KB ($KB_ID) のデータソース削除"
  else
    delete_kb_datasources "$KB_ID"
  fi
else
  skip "CDK KB: スタック未検出"
fi
echo ""

# ========================================
# 2.5. 孤立Bedrock KB削除（CDK管理外）
# ========================================
echo "🧹 Step 2.5/10: 孤立Bedrock KB削除..."
ALL_KB_IDS=$(aws bedrock-agent list-knowledge-bases --region $REGION \
  --query 'knowledgeBaseSummaries[].knowledgeBaseId' --output text 2>/dev/null || echo "")
for ORPHAN_KB in $ALL_KB_IDS; do
  if [ "$ORPHAN_KB" = "$KB_ID" ]; then
    skip "CDK管理KB: $ORPHAN_KB (CDK destroyで削除)"
    continue
  fi
  KB_NAME=$(aws bedrock-agent get-knowledge-base --knowledge-base-id "$ORPHAN_KB" --region $REGION \
    --query 'knowledgeBase.name' --output text 2>/dev/null || echo "unknown")
  info "孤立KB検出: $ORPHAN_KB ($KB_NAME)"
  if [ "$DRY_RUN" = true ]; then
    dry "孤立KB $ORPHAN_KB ($KB_NAME) のデータソース + KB削除"
  else
    delete_kb_datasources "$ORPHAN_KB"
    sleep 5
    aws bedrock-agent delete-knowledge-base --knowledge-base-id "$ORPHAN_KB" --region $REGION 2>/dev/null \
      && ok "孤立KB: $ORPHAN_KB ($KB_NAME)" || fail "孤立KB: $ORPHAN_KB 削除失敗"
  fi
done
[ -z "$ALL_KB_IDS" ] && skip "孤立KB: なし"
echo ""

# ========================================
# 3. 動的作成されたBedrock Agents削除
# ========================================
echo "🧹 Step 3/10: 動的作成Bedrock Agents削除..."
CDK_AGENT_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-AI --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentId`].OutputValue' --output text 2>/dev/null || echo "")
AGENT_IDS=$(aws bedrock-agent list-agents --region $REGION \
  --query 'agentSummaries[].agentId' --output text 2>/dev/null || echo "")
DELETED_COUNT=0
for AGENT_ID in $AGENT_IDS; do
  if [ "$AGENT_ID" = "$CDK_AGENT_ID" ]; then
    skip "CDK管理Agent: $AGENT_ID (CDK destroyで削除)"
    continue
  fi
  run_or_dry "動的Agent: $AGENT_ID" \
    "aws bedrock-agent delete-agent --agent-id $AGENT_ID --skip-resource-in-use-check --region $REGION 2>/dev/null"
  DELETED_COUNT=$((DELETED_COUNT + 1))
done
[ $DELETED_COUNT -eq 0 ] && skip "動的Agent: なし"

# エンタープライズAgent機能リソース削除
SCHEDULES=$(aws scheduler list-schedules --group-name agent-schedules --region $REGION --query 'Schedules[].Name' --output text 2>/dev/null || echo "")
for SCHED in $SCHEDULES; do
  run_or_dry "Schedule: $SCHED" \
    "aws scheduler delete-schedule --name '$SCHED' --group-name agent-schedules --region $REGION 2>/dev/null"
done
run_or_dry "Scheduler Group: agent-schedules" \
  "aws scheduler delete-schedule-group --name agent-schedules --region $REGION 2>/dev/null"

SHARED_BUCKET="${STACK_PREFIX}-shared-agents"
run_or_dry "S3: ${SHARED_BUCKET}" \
  "aws s3 rb 's3://${SHARED_BUCKET}' --force --region $REGION 2>/dev/null"
echo ""

# ========================================
# 4. Embeddingスタック削除（存在する場合）
# ========================================
echo "🧹 Step 4/10: Embeddingスタック削除..."
EMB_STATUS=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Embedding --region $REGION \
  --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "DELETED")
if [ "$EMB_STATUS" != "DELETED" ] && [ "$EMB_STATUS" != "DELETE_COMPLETE" ]; then
  run_or_dry "Embeddingスタック" \
    "aws cloudformation delete-stack --stack-name ${STACK_PREFIX}-Embedding --region $REGION && \
     aws cloudformation wait stack-delete-complete --stack-name ${STACK_PREFIX}-Embedding --region $REGION 2>/dev/null"
else
  skip "Embeddingスタック: 未検出"
fi
echo ""

# ========================================
# 5. CDK destroy
# ========================================
echo "🧹 Step 5/10: CDK destroy..."
if [ "$DRY_RUN" = true ]; then
  dry "npx cdk destroy --all --force"
else
  npx cdk destroy --all --app "npx ts-node bin/demo-app.ts" --force 2>&1 || true
fi
echo ""

# ========================================
# 6. 残留スタックの個別削除
# ========================================
echo "🧹 Step 6/10: 残留スタック確認..."
for S in WebApp AI Storage Security Networking; do
  STATUS=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-${S} --region $REGION \
    --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "DELETED")
  if [ "$STATUS" != "DELETED" ] && [ "$STATUS" != "DELETE_COMPLETE" ]; then
    info "$S: $STATUS → 削除中..."
    if [ "$DRY_RUN" = false ]; then
      aws cloudformation delete-stack --stack-name ${STACK_PREFIX}-${S} --region $REGION 2>/dev/null
      aws cloudformation wait stack-delete-complete --stack-name ${STACK_PREFIX}-${S} --region $REGION 2>/dev/null \
        && ok "$S deleted" || fail "$S deletion failed"
    else
      dry "$S スタック削除"
    fi
  fi
done

# Waf (us-east-1)
WAF_STATUS=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Waf --region us-east-1 \
  --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "DELETED")
if [ "$WAF_STATUS" != "DELETED" ] && [ "$WAF_STATUS" != "DELETE_COMPLETE" ]; then
  info "Waf: $WAF_STATUS → 削除中..."
  if [ "$DRY_RUN" = false ]; then
    aws cloudformation delete-stack --stack-name ${STACK_PREFIX}-Waf --region us-east-1 2>/dev/null
    aws cloudformation wait stack-delete-complete --stack-name ${STACK_PREFIX}-Waf --region us-east-1 2>/dev/null \
      && ok "Waf deleted" || fail "Waf deletion failed"
  else
    dry "Waf スタック削除 (us-east-1)"
  fi
fi
echo ""

# ========================================
# 7. 孤立リソース削除（AD SG, OpenLDAP, VPC内EC2）
# ========================================
echo "🧹 Step 7/10: 孤立リソース削除..."

VPC_ID=$(aws ec2 describe-vpcs --filters "Name=tag:Name,Values=*perm-rag*" --region $REGION \
  --query 'Vpcs[0].VpcId' --output text 2>/dev/null || echo "None")

if [ -n "$VPC_ID" ] && [ "$VPC_ID" != "None" ]; then
  info "VPC検出: $VPC_ID"

  # AD Security Groups
  for SG_ID in $(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" "Name=group-name,Values=d-*_controllers" \
    --region $REGION --query 'SecurityGroups[].GroupId' --output text 2>/dev/null); do
    run_or_dry "AD SG: $SG_ID" "aws ec2 delete-security-group --group-id $SG_ID --region $REGION 2>/dev/null"
  done

  # OpenLDAP EC2
  LDAP_EC2=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=${STACK_PREFIX}-openldap" "Name=instance-state-name,Values=running,stopped" \
    --region $REGION --query 'Reservations[0].Instances[0].InstanceId' --output text 2>/dev/null || echo "None")
  if [ "$LDAP_EC2" != "None" ] && [ -n "$LDAP_EC2" ]; then
    run_or_dry "OpenLDAP EC2: $LDAP_EC2" \
      "aws ec2 terminate-instances --instance-ids '$LDAP_EC2' --region $REGION 2>/dev/null && \
       aws ec2 wait instance-terminated --instance-ids '$LDAP_EC2' --region $REGION 2>/dev/null"
  fi

  # OpenLDAP IAM
  PROFILE_NAME="${STACK_PREFIX}-openldap-profile"
  ROLE_NAME="${STACK_PREFIX}-openldap-role"
  if [ "$DRY_RUN" = false ]; then
    aws iam remove-role-from-instance-profile --instance-profile-name "$PROFILE_NAME" --role-name "$ROLE_NAME" 2>/dev/null || true
    aws iam delete-instance-profile --instance-profile-name "$PROFILE_NAME" 2>/dev/null && ok "IAM Profile: $PROFILE_NAME" || true
    aws iam detach-role-policy --role-name "$ROLE_NAME" --policy-arn "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore" 2>/dev/null || true
    aws iam delete-role --role-name "$ROLE_NAME" 2>/dev/null && ok "IAM Role: $ROLE_NAME" || true
  else
    dry "OpenLDAP IAM Profile/Role 削除"
  fi

  # OpenLDAP SG
  LDAP_SG=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=${STACK_PREFIX}-openldap-sg" \
    --region $REGION --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo "None")
  if [ "$LDAP_SG" != "None" ] && [ -n "$LDAP_SG" ]; then
    run_or_dry "OpenLDAP SG: $LDAP_SG" "aws ec2 delete-security-group --group-id $LDAP_SG --region $REGION 2>/dev/null"
  fi

  # Secrets Manager
  for SECRET in ldap-bind-password ontap-fsxadmin-password; do
    run_or_dry "Secret: $SECRET" \
      "aws secretsmanager delete-secret --secret-id '$SECRET' --force-delete-without-recovery --region $REGION 2>/dev/null"
  done

  # VPC内残留EC2
  EC2_IDS=$(aws ec2 describe-instances --filters "Name=vpc-id,Values=$VPC_ID" "Name=instance-state-name,Values=running,stopped" \
    --region $REGION --query 'Reservations[].Instances[].InstanceId' --output text 2>/dev/null || echo "")
  for EC2_ID in $EC2_IDS; do
    run_or_dry "EC2: $EC2_ID" \
      "aws ec2 terminate-instances --instance-ids $EC2_ID --region $REGION 2>/dev/null && \
       aws ec2 wait instance-terminated --instance-ids $EC2_ID --region $REGION 2>/dev/null"
  done

  # 残留SG削除（default以外）
  for SG_ID in $(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" --region $REGION \
    --query 'SecurityGroups[?GroupName!=`default`].GroupId' --output text 2>/dev/null); do
    run_or_dry "SG: $SG_ID" "aws ec2 delete-security-group --group-id $SG_ID --region $REGION 2>/dev/null"
  done

  # Networkingスタック再削除
  NET_STATUS=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Networking --region $REGION \
    --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "DELETED")
  if [ "$NET_STATUS" = "DELETE_FAILED" ]; then
    info "Networkingスタック再削除..."
    if [ "$DRY_RUN" = false ]; then
      aws cloudformation delete-stack --stack-name ${STACK_PREFIX}-Networking --region $REGION 2>/dev/null
      aws cloudformation wait stack-delete-complete --stack-name ${STACK_PREFIX}-Networking --region $REGION 2>/dev/null \
        && ok "Networking deleted" || fail "Networking deletion failed"
    fi
  fi
else
  skip "VPC: 未検出"
fi
echo ""

# ========================================
# 8. S3 Vectors バケット削除（フォールバック）
# ========================================
echo "🧹 Step 8/10: S3 Vectors バケット削除..."
S3V_BUCKETS=$(aws s3vectors list-vector-buckets --region $REGION \
  --query "vectorBuckets[?starts_with(vectorBucketName, '${STACK_PREFIX}') || starts_with(vectorBucketName, 'perm-rag')].vectorBucketName" \
  --output text 2>/dev/null || echo "")
if [ -n "$S3V_BUCKETS" ]; then
  for VBUCKET in $S3V_BUCKETS; do
    info "S3 Vectors バケット: $VBUCKET"
    if [ "$DRY_RUN" = false ]; then
      # インデックスを先に削除
      INDEXES=$(aws s3vectors list-indexes --vector-bucket-name "$VBUCKET" --region $REGION \
        --query 'indexes[].indexName' --output text 2>/dev/null || echo "")
      for IDX in $INDEXES; do
        aws s3vectors delete-index --vector-bucket-name "$VBUCKET" --index-name "$IDX" --region $REGION 2>/dev/null \
          && ok "S3V Index: $IDX" || skip "S3V Index: $IDX"
      done
      sleep 5
      aws s3vectors delete-vector-bucket --vector-bucket-name "$VBUCKET" --region $REGION 2>/dev/null \
        && ok "S3V Bucket: $VBUCKET" || fail "S3V Bucket: $VBUCKET 削除失敗"
    else
      dry "S3V Bucket: $VBUCKET 削除"
    fi
  done
else
  skip "S3 Vectors: なし"
fi
echo ""

# ========================================
# 9. CloudWatch Log Groups 削除
# ========================================
echo "🧹 Step 9/10: CloudWatch Log Groups 削除..."
LOG_GROUPS=$(aws logs describe-log-groups --region $REGION \
  --query "logGroups[?contains(logGroupName, 'perm-rag') || contains(logGroupName, '${STACK_PREFIX}')].logGroupName" \
  --output text 2>/dev/null || echo "")
LG_COUNT=0
for LG in $LOG_GROUPS; do
  run_or_dry "LogGroup: $LG" \
    "aws logs delete-log-group --log-group-name '$LG' --region $REGION 2>/dev/null"
  LG_COUNT=$((LG_COUNT + 1))
done
[ $LG_COUNT -eq 0 ] && skip "CloudWatch Log Groups: なし"
echo ""

# ========================================
# 10. CDKToolkit + staging S3バケット削除
# ========================================
echo "🧹 Step 10/10: CDKToolkit削除..."

for CDK_REGION in $REGION us-east-1; do
  CDK_STATUS=$(aws cloudformation describe-stacks --stack-name CDKToolkit --region $CDK_REGION \
    --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "DELETED")
  if [ "$CDK_STATUS" != "DELETED" ] && [ "$CDK_STATUS" != "DELETE_COMPLETE" ]; then
    info "CDKToolkit ($CDK_REGION): $CDK_STATUS"
    if [ "$DRY_RUN" = false ]; then
      # ECRリポジトリ削除
      aws ecr delete-repository --repository-name "cdk-hnb659fds-container-assets-${ACCOUNT_ID}-${CDK_REGION}" \
        --force --region $CDK_REGION 2>/dev/null && ok "CDK ECR ($CDK_REGION)" || true

      # S3 stagingバケット削除（バージョニング対応）
      CDK_BUCKET="cdk-hnb659fds-assets-${ACCOUNT_ID}-${CDK_REGION}"
      if aws s3api head-bucket --bucket "$CDK_BUCKET" 2>/dev/null; then
        info "CDK S3バケット ($CDK_REGION) のバージョン付きオブジェクト削除中..."
        # バージョン付きオブジェクト削除
        aws s3api list-object-versions --bucket "$CDK_BUCKET" \
          --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}' --output json 2>/dev/null \
          | aws s3api delete-objects --bucket "$CDK_BUCKET" --delete file:///dev/stdin 2>/dev/null || true
        # 削除マーカー削除
        aws s3api list-object-versions --bucket "$CDK_BUCKET" \
          --query '{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}' --output json 2>/dev/null \
          | aws s3api delete-objects --bucket "$CDK_BUCKET" --delete file:///dev/stdin 2>/dev/null || true
        aws s3api delete-bucket --bucket "$CDK_BUCKET" 2>/dev/null && ok "CDK S3 ($CDK_REGION)" || true
      fi

      # CDKToolkitスタック削除
      aws cloudformation delete-stack --stack-name CDKToolkit --region $CDK_REGION 2>/dev/null
      aws cloudformation wait stack-delete-complete --stack-name CDKToolkit --region $CDK_REGION 2>/dev/null \
        && ok "CDKToolkit ($CDK_REGION)" || fail "CDKToolkit ($CDK_REGION) 削除失敗"
    else
      dry "CDKToolkit ($CDK_REGION) 削除"
    fi
  else
    skip "CDKToolkit ($CDK_REGION): 未検出"
  fi
done
echo ""

# ========================================
# 最終確認
# ========================================
echo "============================================"
echo "  最終確認"
echo "============================================"
if [ "$DRY_RUN" = true ]; then
  echo "  🔍 dry-run モードのため、実際の削除は行われていません。"
  echo "  上記の [dry-run] 項目が削除対象です。"
  echo ""
  exit 0
fi

ALL_CLEAN=true
for S in Embedding WebApp AI Storage Security Networking; do
  STATUS=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-${S} --region $REGION \
    --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "DELETED")
  if [ "$STATUS" = "DELETED" ] || [ "$STATUS" = "DELETE_COMPLETE" ]; then
    ok "$S: DELETED"
  else
    fail "$S: $STATUS"
    ALL_CLEAN=false
  fi
done

WAF_FINAL=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Waf --region us-east-1 \
  --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "DELETED")
if [ "$WAF_FINAL" = "DELETED" ] || [ "$WAF_FINAL" = "DELETE_COMPLETE" ]; then
  ok "Waf: DELETED"
else
  fail "Waf: $WAF_FINAL"
  ALL_CLEAN=false
fi

for CDK_REGION in $REGION us-east-1; do
  CDK_FINAL=$(aws cloudformation describe-stacks --stack-name CDKToolkit --region $CDK_REGION \
    --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "DELETED")
  if [ "$CDK_FINAL" = "DELETED" ] || [ "$CDK_FINAL" = "DELETE_COMPLETE" ]; then
    ok "CDKToolkit ($CDK_REGION): DELETED"
  else
    info "CDKToolkit ($CDK_REGION): $CDK_FINAL (他プロジェクトで使用中の可能性)"
  fi
done

# 残留リソース確認
REMAINING_AGENTS=$(aws bedrock-agent list-agents --region $REGION --query 'length(agentSummaries)' --output text 2>/dev/null || echo "0")
REMAINING_KBS=$(aws bedrock-agent list-knowledge-bases --region $REGION --query 'length(knowledgeBaseSummaries)' --output text 2>/dev/null || echo "0")
REMAINING_S3V=$(aws s3vectors list-vector-buckets --region $REGION --query 'length(vectorBuckets)' --output text 2>/dev/null || echo "0")
REMAINING_S3=$(aws s3 ls 2>/dev/null | grep -c 'perm-rag' || echo "0")

echo ""
echo "  残留リソース:"
echo "    Bedrock Agents:  $REMAINING_AGENTS"
echo "    Bedrock KBs:     $REMAINING_KBS"
echo "    S3 Vectors:      $REMAINING_S3V"
echo "    S3 Buckets:      $REMAINING_S3"

echo ""
if [ "$ALL_CLEAN" = true ] && [ "$REMAINING_AGENTS" = "0" ] && [ "$REMAINING_KBS" = "0" ] && [ "$REMAINING_S3V" = "0" ] && [ "$REMAINING_S3" = "0" ]; then
  echo "✅ 全リソース削除完了"
else
  echo "⚠️  一部リソースが残っています。"
  if [ ${#ERRORS[@]} -gt 0 ]; then
    echo ""
    echo "  エラー一覧:"
    for ERR in "${ERRORS[@]}"; do
      echo "    ❌ $ERR"
    done
  fi
  echo ""
  echo "  手動確認が必要な場合は、AWSコンソールで以下を確認してください:"
  echo "    - CloudFormation > スタック"
  echo "    - Bedrock > ナレッジベース / エージェント"
  echo "    - S3 > バケット"
  echo "    - EC2 > インスタンス / セキュリティグループ"
fi
