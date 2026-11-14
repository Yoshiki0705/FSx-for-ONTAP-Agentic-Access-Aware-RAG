#!/bin/bash
set -euo pipefail
#
# 業種別デモデータパック（demo-data/industry-packs/<業種>/）をデプロイ済みの環境へ読み込む。
#
#   1. パックの文書と .metadata.json を S3 Access Point 経由で FSx for ONTAP にアップロード
#      （プレフィックスは industry-packs/<業種>/）
#   2. Bedrock Knowledge Base のデータソースを同期
#   3. 各パックの部門 A / 部門 B（SID の小さい順に最初の 2 グループ）用のデモユーザーを DynamoDB（SID）と Cognito に登録
#      （<業種>-a@example.com / <業種>-b@example.com。部門グループと Everyone に属する）
#
# post-deploy-setup.sh の実行後に使う（S3 Access Point、データソース、ユーザープールが前提）。
#
# 使用方法:
#   bash demo-data/scripts/load-industry-pack.sh legal healthcare   # 業種を指定
#   bash demo-data/scripts/load-industry-pack.sh all                # 21 業種すべて
#   bash demo-data/scripts/load-industry-pack.sh --dry-run all      # AWS を呼ばずに計画だけ表示
#
# 環境変数: AWS_REGION（既定 ap-northeast-1）、STACK_PREFIX（既定 perm-rag-demo-demo）、
#           DEMO_PASSWORD（既定 DemoPass1234!）

REGION="${AWS_REGION:-ap-northeast-1}"
STACK_PREFIX="${STACK_PREFIX:-perm-rag-demo-demo}"
DEMO_PASSWORD="${DEMO_PASSWORD:-DemoPass1234!}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PACKS_DIR="${SCRIPT_DIR}/../industry-packs"
DOMAIN_SID_PREFIX="S-1-5-21-000-000-000"
EVERYONE="S-1-1-0"
ADMINS_RID="512"

DRY_RUN=false
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=true
  shift
fi
if [ "$#" -eq 0 ]; then
  echo "使用方法: $0 [--dry-run] <業種ID ...|all>" >&2
  exit 2
fi

ALL_PACKS=()
for dir in "${PACKS_DIR}"/*/; do
  ALL_PACKS+=("$(basename "$dir")")
done
if [ "$1" = "all" ]; then
  PACKS=("${ALL_PACKS[@]}")
else
  PACKS=("$@")
fi
for pack in "${PACKS[@]}"; do
  if [ ! -d "${PACKS_DIR}/${pack}" ]; then
    echo "❌ パックがありません: ${pack}（有効: ${ALL_PACKS[*]}）" >&2
    exit 2
  fi
done

# パックの部門グループの RID（Domain Admins と Everyone を除く）を小さい順に出力する。
pack_rids() {
  python3 - "${PACKS_DIR}/$1" <<'PY'
import glob, json, sys
rids = set()
for path in glob.glob(sys.argv[1] + "/*.metadata.json"):
    for sid in json.load(open(path))["metadataAttributes"]["allowed_group_sids"]:
        rid = sid.rsplit("-", 1)[-1]
        if sid != "S-1-1-0" and rid != "512":
            rids.add(int(rid))
print(" ".join(str(r) for r in sorted(rids)))
PY
}

if $DRY_RUN; then
  for pack in "${PACKS[@]}"; do
    read -r -a rids <<<"$(pack_rids "$pack")"
    echo "${pack}: upload industry-packs/${pack}/ ; users ${pack}-a@example.com (${DOMAIN_SID_PREFIX}-${rids[0]:-?}) ${pack}-b@example.com (${DOMAIN_SID_PREFIX}-${rids[1]:-?})"
  done
  exit 0
fi

echo "🔍 スタック出力から情報を取得中..."
out() { aws cloudformation describe-stacks --stack-name "${STACK_PREFIX}-$1" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue" --output text; }
VOLUME_ID=$(out Storage VolumeId)
S3AP_NAME=$(out Storage S3AccessPointName)
USER_ACCESS_TABLE=$(out Storage UserAccessTableName)
KB_ID=$(out AI KnowledgeBaseId)
USER_POOL_ID=$(out Security UserPoolId)
S3AP_ALIAS=$(aws fsx describe-s3-access-point-attachments --region "$REGION" \
  --query "S3AccessPointAttachments[?Name=='${S3AP_NAME}'].S3AccessPoint.Alias | [0]" --output text)
DS_ID=$(aws bedrock-agent list-data-sources --knowledge-base-id "$KB_ID" --region "$REGION" \
  --query 'dataSourceSummaries[0].dataSourceId' --output text)
for v in S3AP_ALIAS DS_ID KB_ID USER_POOL_ID USER_ACCESS_TABLE; do
  if [ -z "${!v}" ] || [ "${!v}" = "None" ]; then
    echo "❌ ${v} を取得できません。post-deploy-setup.sh を先に実行してください" >&2
    exit 1
  fi
done
echo "  Volume: ${VOLUME_ID}  S3 AP: ${S3AP_NAME} (${S3AP_ALIAS})  KB: ${KB_ID}  DS: ${DS_ID}"

echo "📤 パックをアップロード..."
for pack in "${PACKS[@]}"; do
  aws s3 sync "${PACKS_DIR}/${pack}/" "s3://${S3AP_ALIAS}/industry-packs/${pack}/" --region "$REGION" --only-show-errors
  echo "  ✅ ${pack}"
done

echo "🔄 データソースを同期..."
JOB_ID=$(aws bedrock-agent start-ingestion-job --knowledge-base-id "$KB_ID" --data-source-id "$DS_ID" \
  --region "$REGION" --query 'ingestionJob.ingestionJobId' --output text)
for _ in $(seq 1 60); do
  STATUS=$(aws bedrock-agent get-ingestion-job --knowledge-base-id "$KB_ID" --data-source-id "$DS_ID" \
    --ingestion-job-id "$JOB_ID" --region "$REGION" --query 'ingestionJob.status' --output text)
  [ "$STATUS" = "COMPLETE" ] || [ "$STATUS" = "FAILED" ] && break
  sleep 10
done
aws bedrock-agent get-ingestion-job --knowledge-base-id "$KB_ID" --data-source-id "$DS_ID" \
  --ingestion-job-id "$JOB_ID" --region "$REGION" --query 'ingestionJob.[status,statistics]' --output json
if [ "$STATUS" != "COMPLETE" ]; then
  echo "❌ 同期が完了しませんでした（${STATUS}）" >&2
  exit 1
fi

echo "👤 デモユーザーを登録..."
for pack in "${PACKS[@]}"; do
  read -r -a rids <<<"$(pack_rids "$pack")"
  for idx in 0 1; do
    suffix=$([ "$idx" = 0 ] && echo a || echo b)
    email="${pack}-${suffix}@example.com"
    group_sid="${DOMAIN_SID_PREFIX}-${rids[$idx]}"
    aws dynamodb put-item --table-name "$USER_ACCESS_TABLE" --region "$REGION" --item '{
      "userId":{"S":"'"${email}"'"},"userSID":{"S":"'"${DOMAIN_SID_PREFIX}-$((9000 + idx))"'"},
      "groupSIDs":{"L":[{"S":"'"${group_sid}"'"},{"S":"'"${EVERYONE}"'"}]},
      "displayName":{"S":"'"${pack} dept ${suffix}"'"},"source":{"S":"Demo"}}'
    if ! OUT=$(aws cognito-idp admin-create-user --user-pool-id "$USER_POOL_ID" --username "$email" \
        --user-attributes Name=email,Value="$email" Name=email_verified,Value=true \
        --temporary-password "TempPass1234!" --message-action SUPPRESS --region "$REGION" 2>&1); then
      [[ "$OUT" == *UsernameExistsException* ]] || { echo "❌ ${email}: ${OUT}" >&2; exit 1; }
    fi
    aws cognito-idp admin-set-user-password --user-pool-id "$USER_POOL_ID" --username "$email" \
      --password "$DEMO_PASSWORD" --permanent --region "$REGION"
    echo "  ✅ ${email} (${group_sid} + Everyone)"
  done
done
echo "完了。サインイン: <業種>-a@example.com / <業種>-b@example.com（パスワード: ${DEMO_PASSWORD}）"
