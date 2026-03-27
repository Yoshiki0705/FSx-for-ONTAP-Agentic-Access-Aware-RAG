#!/bin/bash
set -euo pipefail
#
# Permission-aware RAG デモ環境 ポストデプロイセットアップ
#
# CDKデプロイ完了後に1回実行するだけで、以下を自動的に行います:
#   1. S3 Access Point の確認・作成 + ポリシー設定
#   2. FSx ONTAP にデモデータをアップロード（S3 AP経由）
#   3. Bedrock KB にデータソース追加 + 同期
#   4. DynamoDB にユーザーSIDデータを登録
#   5. Cognito にデモユーザーを作成
#
# 使用方法:
#   bash demo-data/scripts/post-deploy-setup.sh
#
# 前提条件:
#   - CDKデプロイ完了（6スタック全て CREATE_COMPLETE）
#   - AWS CLI設定済み（適切なIAM権限）

REGION="${AWS_REGION:-ap-northeast-1}"
STACK_PREFIX="${STACK_PREFIX:-perm-rag-demo-demo}"
DEMO_PASSWORD="${DEMO_PASSWORD:-DemoPass1234}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "============================================"
echo "  Permission-aware RAG ポストデプロイセットアップ"
echo "============================================"
echo "  Region: $REGION"
echo "  Stack Prefix: $STACK_PREFIX"
echo ""

# ========================================
# 0. スタック出力から情報を取得
# ========================================
echo "🔍 スタック出力から情報を取得中..."

VOLUME_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`VolumeId`].OutputValue' --output text)
S3AP_NAME=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`S3AccessPointName`].OutputValue' --output text)
USER_ACCESS_TABLE=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`UserAccessTableName`].OutputValue' --output text)
KB_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-AI --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`KnowledgeBaseId`].OutputValue' --output text)
AGENT_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-AI --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentId`].OutputValue' --output text 2>/dev/null || echo "")
AGENT_ALIAS_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-AI --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentAliasId`].OutputValue' --output text 2>/dev/null || echo "")
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Security --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)
LAMBDA_URL=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionUrl`].OutputValue' --output text)
CF_URL=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-WebApp --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' --output text)
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "  Volume ID: $VOLUME_ID"
echo "  S3 AP Name: $S3AP_NAME"
echo "  KB ID: $KB_ID"
if [ -n "$AGENT_ID" ] && [ "$AGENT_ID" != "None" ]; then
  echo "  Agent ID: $AGENT_ID"
  echo "  Agent Alias: $AGENT_ALIAS_ID"
fi
echo "  User Pool: $USER_POOL_ID"
echo "  Lambda URL: $LAMBDA_URL"
echo "  CloudFront: $CF_URL"
echo ""

# ========================================
# 1. S3 Access Point の確認・作成
# ========================================
echo "📎 Step 1/5: S3 Access Point セットアップ..."

# S3 APユーザータイプを判定（CDKスタック出力から取得）
S3AP_USER_TYPE=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`S3AccessPointUserType`].OutputValue' --output text 2>/dev/null || echo "UNIX")
# "WINDOWS (...)" → "WINDOWS" に正規化
S3AP_USER_TYPE=$(echo "$S3AP_USER_TYPE" | awk '{print $1}')
echo "  S3 AP User Type: $S3AP_USER_TYPE"

S3AP_ALIAS=$(aws fsx describe-s3-access-point-attachments --region $REGION \
  --query "S3AccessPointAttachments[?Name=='${S3AP_NAME}'].S3AccessPoint.Alias" --output text 2>/dev/null || echo "")

if [ -z "$S3AP_ALIAS" ] || [ "$S3AP_ALIAS" = "None" ] || [ "$S3AP_ALIAS" = "" ]; then
  echo "  S3 AP が存在しません。作成します..."

  # ユーザータイプに応じてFileSystemIdentityを構築
  if [ "$S3AP_USER_TYPE" = "WINDOWS" ]; then
    # WINDOWS: SVMがAD参加済みであることが前提
    # ADドメイン名を取得
    AD_DOMAIN=$(aws cloudformation describe-stacks --stack-name ${STACK_PREFIX}-Storage --region $REGION \
      --query 'Stacks[0].Outputs[?OutputKey==`AdDomainName`].OutputValue' --output text 2>/dev/null || echo "demo.local")
    FS_IDENTITY="{\"Type\":\"WINDOWS\",\"WindowsUser\":{\"Name\":\"${AD_DOMAIN}\\\\Admin\"}}"
    echo "  WINDOWS identity: ${AD_DOMAIN}\\Admin"
    echo "  ⚠️ SVMがADドメインに参加済みであることを確認してください"
  else
    # UNIX: AD不要
    FS_IDENTITY='{"Type":"UNIX","UnixUser":{"Name":"root"}}'
    echo "  UNIX identity: root"
  fi

  aws fsx create-and-attach-s3-access-point \
    --name "$S3AP_NAME" \
    --type ONTAP \
    --ontap-configuration "{\"VolumeId\":\"${VOLUME_ID}\",\"FileSystemIdentity\":${FS_IDENTITY}}" \
    --region $REGION --output json > /dev/null 2>&1

  echo "  ⏳ S3 AP 作成完了を待機中..."
  for i in $(seq 1 30); do
    sleep 10
    S3AP_STATUS=$(aws fsx describe-s3-access-point-attachments --region $REGION \
      --query "S3AccessPointAttachments[?Name=='${S3AP_NAME}'].Lifecycle" --output text 2>/dev/null || echo "")
    if [ "$S3AP_STATUS" = "AVAILABLE" ]; then break; fi
    echo "    [$i/30] $S3AP_STATUS"
  done

  S3AP_ALIAS=$(aws fsx describe-s3-access-point-attachments --region $REGION \
    --query "S3AccessPointAttachments[?Name=='${S3AP_NAME}'].S3AccessPoint.Alias" --output text)
fi

S3AP_ARN=$(aws fsx describe-s3-access-point-attachments --region $REGION \
  --query "S3AccessPointAttachments[?Name=='${S3AP_NAME}'].S3AccessPoint.ResourceARN" --output text)

echo "  ✅ S3 AP: $S3AP_NAME (Alias: $S3AP_ALIAS)"

# S3 APポリシー設定
echo "  📋 S3 APポリシーを設定中..."
aws s3control put-access-point-policy --account-id $ACCOUNT_ID --name $S3AP_NAME \
  --policy "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Sid\":\"AllowAll\",\"Effect\":\"Allow\",\"Principal\":{\"AWS\":\"arn:aws:iam::${ACCOUNT_ID}:root\"},\"Action\":[\"s3:GetObject\",\"s3:PutObject\",\"s3:ListBucket\"],\"Resource\":[\"${S3AP_ARN}\",\"${S3AP_ARN}/object/*\"]}]}" \
  --region $REGION 2>/dev/null && echo "  ✅ ポリシー設定完了" || echo "  ⚠️ ポリシー設定スキップ（既存）"
echo ""

# ========================================
# 2. デモデータアップロード
# ========================================
echo "📤 Step 2/5: デモデータをFSx ONTAPにアップロード..."
aws s3 sync "${SCRIPT_DIR}/../documents/" "s3://${S3AP_ALIAS}/" --region $REGION 2>&1 | grep -c "upload:" | xargs -I{} echo "  ✅ {}ファイルアップロード完了"
echo ""

# ========================================
# 3. Bedrock KB データソース追加 + 同期
# ========================================
echo "📚 Step 3/5: Bedrock KB データソースセットアップ..."

# 既存データソースを確認
EXISTING_DS=$(aws bedrock-agent list-data-sources --knowledge-base-id $KB_ID --region $REGION \
  --query 'dataSourceSummaries[0].dataSourceId' --output text 2>/dev/null || echo "")

if [ -n "$EXISTING_DS" ] && [ "$EXISTING_DS" != "None" ] && [ "$EXISTING_DS" != "" ]; then
  DS_ID="$EXISTING_DS"
  echo "  既存データソース使用: $DS_ID"
else
  BUCKET_ARN="arn:aws:s3:::${S3AP_ALIAS}"
  DS_RESULT=$(aws bedrock-agent create-data-source \
    --knowledge-base-id $KB_ID \
    --name "${STACK_PREFIX}-s3ap-datasource" \
    --data-source-configuration "{\"type\":\"S3\",\"s3Configuration\":{\"bucketArn\":\"${BUCKET_ARN}\"}}" \
    --region $REGION --output json 2>&1)
  DS_ID=$(echo "$DS_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['dataSource']['dataSourceId'])" 2>/dev/null)
  echo "  ✅ データソース作成: $DS_ID"
fi

# 同期
echo "  🔄 データソース同期中..."
SYNC_RESULT=$(aws bedrock-agent start-ingestion-job --knowledge-base-id $KB_ID --data-source-id $DS_ID --region $REGION --output json 2>&1)
JOB_ID=$(echo "$SYNC_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['ingestionJob']['ingestionJobId'])" 2>/dev/null)

for i in $(seq 1 60); do
  sleep 10
  JOB_STATUS=$(aws bedrock-agent get-ingestion-job --knowledge-base-id $KB_ID --data-source-id $DS_ID --ingestion-job-id $JOB_ID --region $REGION --query 'ingestionJob.status' --output text 2>/dev/null)
  if [ "$JOB_STATUS" = "COMPLETE" ]; then
    STATS=$(aws bedrock-agent get-ingestion-job --knowledge-base-id $KB_ID --data-source-id $DS_ID --ingestion-job-id $JOB_ID --region $REGION --query 'ingestionJob.statistics.numberOfNewDocumentsIndexed' --output text 2>/dev/null)
    echo "  ✅ 同期完了（${STATS}ドキュメントインデックス）"
    break
  elif [ "$JOB_STATUS" = "FAILED" ]; then
    echo "  ❌ 同期失敗"
    break
  fi
  [ $((i % 6)) -eq 0 ] && echo "    [$i] $JOB_STATUS"
done
echo ""

# ========================================
# 4. ユーザーSIDデータ登録
# ========================================
echo "🔑 Step 4/5: ユーザーSIDデータ登録..."

DOMAIN_SID="S-1-5-21-0000000000-0000000000-0000000000"

# admin
aws dynamodb put-item --table-name "$USER_ACCESS_TABLE" --region "$REGION" --item '{
  "userId":{"S":"admin@example.com"},"userSID":{"S":"'"${DOMAIN_SID}-500"'"},
  "groupSIDs":{"L":[{"S":"'"${DOMAIN_SID}-512"'"},{"S":"S-1-1-0"}]},
  "displayName":{"S":"Admin User"},"source":{"S":"Demo"}}' 2>/dev/null
echo "  ✅ admin@example.com (Domain Admins + Everyone)"

# user
aws dynamodb put-item --table-name "$USER_ACCESS_TABLE" --region "$REGION" --item '{
  "userId":{"S":"user@example.com"},"userSID":{"S":"'"${DOMAIN_SID}-1001"'"},
  "groupSIDs":{"L":[{"S":"S-1-1-0"}]},
  "displayName":{"S":"Regular User"},"source":{"S":"Demo"}}' 2>/dev/null
echo "  ✅ user@example.com (Everyone only)"
echo ""

# ========================================
# 5. Cognitoデモユーザー作成
# ========================================
echo "👤 Step 5/5: Cognitoデモユーザー作成..."

for EMAIL in admin@example.com user@example.com; do
  aws cognito-idp admin-create-user --user-pool-id "$USER_POOL_ID" --username "$EMAIL" \
    --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true \
    --temporary-password "TempPass1234" --message-action SUPPRESS --region "$REGION" 2>/dev/null || true
  aws cognito-idp admin-set-user-password --user-pool-id "$USER_POOL_ID" --username "$EMAIL" \
    --password "$DEMO_PASSWORD" --permanent --region "$REGION" 2>/dev/null
  echo "  ✅ $EMAIL (password: $DEMO_PASSWORD)"
done
echo ""

# ========================================
# 完了
# ========================================
echo "============================================"
echo "  ✅ セットアップ完了"
echo "============================================"
echo ""
echo "  アクセスURL: $CF_URL"
echo "  Lambda URL:  $LAMBDA_URL"
echo ""
echo "  デモユーザー:"
echo "    admin@example.com / $DEMO_PASSWORD (全ドキュメントアクセス可)"
echo "    user@example.com  / $DEMO_PASSWORD (公開ドキュメントのみ)"
echo ""
echo "  KB ID: $KB_ID"
echo "  S3 AP: $S3AP_NAME ($S3AP_ALIAS)"
if [ -n "$AGENT_ID" ] && [ "$AGENT_ID" != "None" ]; then
  echo "  Agent ID: $AGENT_ID (Alias: $AGENT_ALIAS_ID)"
fi
echo ""
echo "  検証コマンド:"
echo "    # KBモード: 管理者テスト（機密情報にアクセス可能）"
echo "    curl -s -X POST '${LAMBDA_URL}api/bedrock/kb/retrieve' \\"
echo "      -H 'Content-Type: application/json' \\"
echo "      -d '{\"query\":\"財務状況\",\"userId\":\"admin@example.com\",\"knowledgeBaseId\":\"${KB_ID}\",\"region\":\"${REGION}\"}'"
echo ""
echo "    # KBモード: 一般ユーザーテスト（機密情報にアクセス不可）"
echo "    curl -s -X POST '${LAMBDA_URL}api/bedrock/kb/retrieve' \\"
echo "      -H 'Content-Type: application/json' \\"
echo "      -d '{\"query\":\"財務状況\",\"userId\":\"user@example.com\",\"knowledgeBaseId\":\"${KB_ID}\",\"region\":\"${REGION}\"}'"
if [ -n "$AGENT_ID" ] && [ "$AGENT_ID" != "None" ]; then
  echo ""
  echo "    # Agentモード: 管理者テスト"
  echo "    curl -s -X POST '${LAMBDA_URL}api/bedrock/agent' \\"
  echo "      -H 'Content-Type: application/json' \\"
  echo "      -d '{\"message\":\"財務状況\",\"userId\":\"admin@example.com\",\"sessionId\":\"test-001\",\"action\":\"invoke\"}'"
  echo ""
  echo "    # Agentモード: 一般ユーザーテスト"
  echo "    curl -s -X POST '${LAMBDA_URL}api/bedrock/agent' \\"
  echo "      -H 'Content-Type: application/json' \\"
  echo "      -d '{\"message\":\"財務状況\",\"userId\":\"user@example.com\",\"sessionId\":\"test-002\",\"action\":\"invoke\"}'"
fi
