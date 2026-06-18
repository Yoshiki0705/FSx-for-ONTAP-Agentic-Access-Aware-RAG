#!/bin/bash
set -euo pipefail
#
# S3 VectorsインデックスをOpenSearch Serverlessにエクスポートする運用スクリプト
#
# S3 Vectors構成（vectorStoreType=s3vectors）でデプロイ済みの環境に対して、
# CloudFormation出力からS3 Vectors情報を取得し、
# コンソールベースのエクスポート手順をガイドします。
#
# 注意: コンソールの「Create and use a new service role」オプションで
# IAMロールが自動作成されるため、このスクリプトでのロール作成はオプションです。
# コンソールの自動作成を使用する場合はStep 3をスキップできます。
#
# エクスポートはポイントインタイムのコピーであり、継続的な同期は行われません。
# データ更新後は再エクスポートが必要です。
# エクスポート所要時間は約15分（AOSS作成5分 + パイプライン作成5分 + データ転送5分）。
#
# 前提条件:
#   - AWS CLIがインストール・設定済み
#   - vectorStoreType=s3vectors でCDKデプロイ済み
#
# 使用方法:
#   bash demo-data/scripts/export-to-opensearch.sh [STACK_NAME]
#
# パラメータ:
#   STACK_NAME  CloudFormationスタック名（デフォルト: perm-rag-demo-demo-AI）

STACK_NAME="${1:-perm-rag-demo-demo-AI}"
REGION="${AWS_REGION:-ap-northeast-1}"
ACCOUNT_ID=""
ROLE_NAME="s3vectors-export-to-opensearch-role"
POLICY_NAME="s3vectors-export-to-opensearch-policy"
DLQ_BUCKET_NAME=""

# ============================================================
# ユーティリティ関数
# ============================================================

log_info() {
  echo "ℹ️  $1"
}

log_success() {
  echo "✅ $1"
}

log_error() {
  echo "❌ $1" >&2
}

log_step() {
  echo ""
  echo "============================================"
  echo "  $1"
  echo "============================================"
}

# ============================================================
# 1. 前提条件チェック
# ============================================================

log_step "1. 前提条件チェック"

# AWS CLI存在チェック
if ! command -v aws &> /dev/null; then
  log_error "AWS CLIがインストールされていません。"
  log_error "インストール: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
  exit 1
fi
log_success "AWS CLI: $(aws --version 2>&1 | head -1)"

# AWS認証チェック
ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text 2>/dev/null || echo "")
if [ -z "$ACCOUNT_ID" ]; then
  log_error "AWS認証が設定されていません。'aws configure' を実行してください。"
  exit 1
fi
log_success "AWSアカウント: $ACCOUNT_ID"
log_info "リージョン: $REGION"
log_info "スタック名: $STACK_NAME"

# ============================================================
# 2. CloudFormation出力の取得
# ============================================================

log_step "2. CloudFormation出力の取得"

# スタック存在チェック
STACK_STATUS=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].StackStatus' \
  --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$STACK_STATUS" = "NOT_FOUND" ]; then
  log_error "スタック '$STACK_NAME' が見つかりません。"
  log_error "正しいスタック名を指定してください。"
  log_error "使用方法: $0 [STACK_NAME]"
  exit 1
fi
log_success "スタックステータス: $STACK_STATUS"

# VectorStoreType取得・検証
VECTOR_STORE_TYPE=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`VectorStoreType`].OutputValue' \
  --output text 2>/dev/null || echo "")

if [ "$VECTOR_STORE_TYPE" != "s3vectors" ]; then
  log_error "このスクリプトは vectorStoreType=s3vectors の環境でのみ使用できます。"
  log_error "現在の構成: ${VECTOR_STORE_TYPE:-未設定}"
  log_error "opensearch-serverless 構成では、既にAOSSが使用されているためエクスポートは不要です。"
  exit 1
fi
log_success "VectorStoreType: $VECTOR_STORE_TYPE"

# S3 Vectors情報の取得
VECTOR_BUCKET_ARN=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`VectorBucketArn`].OutputValue' \
  --output text 2>/dev/null || echo "")

VECTOR_INDEX_ARN=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`VectorIndexArn`].OutputValue' \
  --output text 2>/dev/null || echo "")

if [ -z "$VECTOR_BUCKET_ARN" ] || [ -z "$VECTOR_INDEX_ARN" ]; then
  log_error "S3 Vectorsリソース情報がCloudFormation出力から取得できません。"
  log_error "VectorBucketArn: ${VECTOR_BUCKET_ARN:-未設定}"
  log_error "VectorIndexArn: ${VECTOR_INDEX_ARN:-未設定}"
  exit 1
fi

log_success "VectorBucketArn: $VECTOR_BUCKET_ARN"
log_success "VectorIndexArn: $VECTOR_INDEX_ARN"


# ============================================================
# 3. エクスポート用IAMロールの作成
# ============================================================

log_step "3. エクスポート用IAMロールの作成"

# 信頼ポリシー（S3 VectorsサービスとOSIパイプラインがAssumeRole可能）
TRUST_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "osis-pipelines.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
)

# IAMロールの存在チェック
EXISTING_ROLE=$(aws iam get-role --role-name "$ROLE_NAME" 2>/dev/null || echo "")

if [ -n "$EXISTING_ROLE" ]; then
  log_info "IAMロール '$ROLE_NAME' は既に存在します。ポリシーを更新します。"
else
  log_info "IAMロール '$ROLE_NAME' を作成中..."
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST_POLICY" \
    --description "S3 Vectors to OpenSearch Serverless export role" \
    --tags Key=Purpose,Value=s3vectors-export Key=ManagedBy,Value=export-script \
    > /dev/null 2>&1

  if [ $? -ne 0 ]; then
    log_error "IAMロールの作成に失敗しました。"
    exit 1
  fi
  log_success "IAMロール作成完了: $ROLE_NAME"
fi

# 権限ポリシー
PERMISSIONS_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3VectorsRead",
      "Effect": "Allow",
      "Action": [
        "s3vectors:ListVectors",
        "s3vectors:GetVectors"
      ],
      "Resource": [
        "${VECTOR_BUCKET_ARN}",
        "${VECTOR_BUCKET_ARN}/*"
      ]
    },
    {
      "Sid": "AOSSWrite",
      "Effect": "Allow",
      "Action": [
        "aoss:APIAccessAll",
        "aoss:BatchGetCollection",
        "aoss:CreateSecurityPolicy",
        "aoss:UpdateSecurityPolicy",
        "aoss:GetSecurityPolicy"
      ],
      "Resource": "*"
    },
    {
      "Sid": "S3DLQWrite",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::*-export-dlq-*/*"
    }
  ]
}
EOF
)

# インラインポリシーの適用
aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "$POLICY_NAME" \
  --policy-document "$PERMISSIONS_POLICY" \
  > /dev/null 2>&1

log_success "IAMポリシー適用完了: $POLICY_NAME"

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
log_success "ロールARN: $ROLE_ARN"

# ============================================================
# 4. エクスポート手順ガイド
# ============================================================

log_step "4. コンソールベースのエクスポート手順"

cat <<'GUIDE'

以下の手順でS3 VectorsインデックスをOpenSearch Serverlessにエクスポートします。
エクスポート時にAOSSコレクションとOSIパイプラインが自動作成されます。

┌─────────────────────────────────────────────────────────────┐
│  Step 1: S3コンソールにアクセス                              │
│                                                             │
│  AWS Management Console → S3 → 左メニュー「Vector buckets」 │
│  URL: https://s3.console.aws.amazon.com/s3vectors/          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 2: ベクトルバケットを選択                              │
│                                                             │
│  一覧からデプロイ済みのベクトルバケットをクリック             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 3: ベクトルインデックスを選択                          │
│                                                             │
│  「bedrock-knowledge-base-default-index」をクリック          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Step 4: エクスポートを開始                                  │
│                                                             │
│  「Advanced search export」→「Export to OpenSearch」を選択   │
│                                                             │
│  設定項目:                                                   │
│    - IAM Role: 上記で作成したロールARNを指定                 │
│    - その他はデフォルト設定でOK                               │
│                                                             │
│  ※ AOSSコレクションとOSIパイプラインが自動作成されます       │
└─────────────────────────────────────────────────────────────┘

GUIDE

echo "  📋 エクスポート設定に使用する情報:"
echo "  ─────────────────────────────────"
echo "  IAM Role ARN: $ROLE_ARN"
echo "  Vector Bucket ARN: $VECTOR_BUCKET_ARN"
echo "  Vector Index ARN: $VECTOR_INDEX_ARN"
echo "  リージョン: $REGION"
echo ""

# ============================================================
# 5. エクスポート完了後の確認手順
# ============================================================

log_step "5. エクスポート完了後の確認手順"

cat <<'VERIFY'

エクスポート完了後、以下の手順で確認してください:

  1. AOSSコレクションの確認
     AWS Console → OpenSearch Service → Serverless → Collections
     - 自動作成されたコレクションが「ACTIVE」であることを確認

  2. データの確認
     OpenSearch Dashboards（コレクション詳細からアクセス）で
     インデックスにドキュメントが存在することを確認

  3. 検索テスト
     OpenSearch Dashboards の Dev Tools で検索クエリを実行し、
     期待する結果が返ることを確認

VERIFY

# ============================================================
# 6. 注意事項
# ============================================================

log_step "6. 注意事項"

cat <<'NOTES'

  ⚠️  重要な注意事項:

  • ポイントインタイムコピー:
    エクスポートはポイントインタイムのコピーです。
    S3 Vectorsのデータが更新された場合、再エクスポートが必要です。
    継続的な同期は行われません。

  • AOSSコレクションのコスト:
    エクスポートで自動作成されたAOSSコレクションは、
    存在する限りOCU課金（最低2 OCU、約$700/月）が発生します。
    不要になったらAOSSコレクションを手動で削除してコストを停止してください。

    削除手順:
      AWS Console → OpenSearch Service → Serverless → Collections
      → 対象コレクションを選択 → 「Delete」

  • IAMロールのクリーンアップ:
    エクスポートが不要になった場合、以下のコマンドでIAMロールを削除できます:

      aws iam delete-role-policy --role-name s3vectors-export-to-opensearch-role \
        --policy-name s3vectors-export-to-opensearch-policy
      aws iam delete-role --role-name s3vectors-export-to-opensearch-role

NOTES

log_success "エクスポート準備が完了しました。上記の手順に従ってコンソールからエクスポートを実行してください。"
