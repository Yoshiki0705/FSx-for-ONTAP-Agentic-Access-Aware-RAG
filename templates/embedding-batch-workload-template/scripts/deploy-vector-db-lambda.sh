#!/bin/bash

# Vector Database統合Lambda関数のデプロイスクリプト
# 実際のVector Database統合機能をテストするためのLambda関数をデプロイします

set -euo pipefail

# エラー時のクリーンアップ処理
cleanup() {
    local exit_code=$?
    log_info "クリーンアップを実行中..."
    
    # 一時ファイルの削除
    rm -rf /tmp/vector-db-lambda-deploy 2>/dev/null || true
    rm -f /tmp/trust-policy.json /tmp/vector-db-policy.json 2>/dev/null || true
    rm -f /tmp/health-response.json /tmp/config-response.json /tmp/connection-response.json 2>/dev/null || true
    
    if [[ $exit_code -ne 0 ]]; then
        log_error "スクリプトがエラーで終了しました (終了コード: $exit_code)"
    fi
    
    exit $exit_code
}

# トラップ設定
trap cleanup EXIT INT TERM

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 関数定義
log_info() {
    echo "ℹ️  $1"
}

log_success() {
    echo "✅ $1"
}

log_error() {
    echo "❌ $1"
}

log_warning() {
    echo "⚠️  $1"
}

# 設定ファイルの読み込み
CONFIG_FILE="${PROJECT_ROOT}/config/deployment-config.json"
if [[ ! -f "$CONFIG_FILE" ]]; then
    log_error "設定ファイルが見つかりません: $CONFIG_FILE"
    exit 1
fi

# 設定値の取得と検証
PROJECT_NAME=$(jq -r '.projectName // "embedding-vector-db"' "$CONFIG_FILE")
ENVIRONMENT=$(jq -r '.environment // "dev"' "$CONFIG_FILE")
REGION=$(jq -r '.region // "ap-northeast-1"' "$CONFIG_FILE")
AWS_PROFILE=$(jq -r '.aws.profile // "default"' "$CONFIG_FILE")

# 入力値検証
validate_config() {
    if [[ -z "$PROJECT_NAME" || "$PROJECT_NAME" == "null" ]]; then
        log_error "プロジェクト名が設定されていません"
        exit 1
    fi
    
    if [[ -z "$ENVIRONMENT" || "$ENVIRONMENT" == "null" ]]; then
        log_error "環境名が設定されていません"
        exit 1
    fi
    
    if [[ -z "$REGION" || "$REGION" == "null" ]]; then
        log_error "リージョンが設定されていません"
        exit 1
    fi
    
    # プロジェクト名の文字数制限（Lambda関数名制限）
    if [[ ${#PROJECT_NAME} -gt 40 ]]; then
        log_error "プロジェクト名が長すぎます（40文字以内）: $PROJECT_NAME"
        exit 1
    fi
    
    # 英数字とハイフンのみ許可
    if [[ ! "$PROJECT_NAME" =~ ^[a-zA-Z0-9-]+$ ]]; then
        log_error "プロジェクト名に無効な文字が含まれています: $PROJECT_NAME"
        exit 1
    fi
}

validate_config

# Vector Database設定の取得
OPENSEARCH_SERVERLESS_ENABLED=$(jq -r '.vectorDatabases.opensearchServerless.enabled // false' "$CONFIG_FILE")
OPENSEARCH_SERVERLESS_ENDPOINT=$(jq -r '.vectorDatabases.opensearchServerless.external.collectionEndpoint // ""' "$CONFIG_FILE")
OPENSEARCH_SERVERLESS_COLLECTION_ID=$(jq -r '.vectorDatabases.opensearchServerless.external.collectionId // ""' "$CONFIG_FILE")
OPENSEARCH_SERVERLESS_INDEX=$(jq -r '.vectorDatabases.opensearchServerless.external.indexName // "embeddings"' "$CONFIG_FILE")

log_info "Vector Database統合Lambda関数をデプロイします"
log_info "プロジェクト: $PROJECT_NAME"
log_info "環境: $ENVIRONMENT"
log_info "リージョン: $REGION"

# Lambda関数の準備
prepare_lambda_function() {
    log_info "Lambda関数パッケージを準備中..."
    
    local lambda_dir="/tmp/vector-db-lambda-deploy"
    rm -rf "$lambda_dir"
    mkdir -p "$lambda_dir"
    
    # Lambda関数のソースファイル存在確認
    local source_files=(
        "$PROJECT_ROOT/lambda/embedding-generator/index.js"
        "$PROJECT_ROOT/lambda/embedding-generator/package.json"
    )
    
    for file in "${source_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log_error "必要なファイルが見つかりません: $file"
            exit 1
        fi
    done
    
    # Lambda関数のコードをコピー
    cp "$PROJECT_ROOT/lambda/embedding-generator/index.js" "$lambda_dir/"
    cp "$PROJECT_ROOT/lambda/embedding-generator/package.json" "$lambda_dir/"
    
    # 依存関係をインストール
    cd "$lambda_dir"
    if ! npm install --production --silent; then
        log_error "npm installが失敗しました"
        exit 1
    fi
    
    # ZIPファイルを作成
    if ! zip -r function.zip . -x "*.git*" "*.DS_Store*" > /dev/null; then
        log_error "ZIPファイルの作成に失敗しました"
        exit 1
    fi
    
    # ZIPファイルサイズ確認（50MB制限）
    local zip_size
    zip_size=$(stat -c%s function.zip 2>/dev/null || stat -f%z function.zip 2>/dev/null || echo "0")
    local max_size=$((50 * 1024 * 1024))  # 50MB
    
    if [[ $zip_size -gt $max_size ]]; then
        log_error "ZIPファイルサイズが制限を超えています: $(($zip_size / 1024 / 1024))MB > 50MB"
        exit 1
    fi
    
    log_success "Lambda関数パッケージを準備しました (サイズ: $(($zip_size / 1024))KB)"
    echo "$lambda_dir"
}

# IAM実行ロールの作成
create_execution_role() {
    log_info "Lambda実行ロールを確認中..."
    
    local role_name="VectorDbLambdaExecutionRole"
    local role_arn=""
    
    # ロールが存在するか確認
    if aws iam get-role --role-name "$role_name" --profile "$AWS_PROFILE" >/dev/null 2>&1; then
        role_arn=$(aws iam get-role --role-name "$role_name" --profile "$AWS_PROFILE" --query 'Role.Arn' --output text)
        log_info "既存のロールを使用します: $role_arn"
    else
        log_info "新しいIAMロールを作成中..."
        
        # 信頼ポリシーを作成
        cat > /tmp/trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

        # ロールを作成
        aws iam create-role \
            --role-name "$role_name" \
            --assume-role-policy-document file:///tmp/trust-policy.json \
            --profile "$AWS_PROFILE"
        
        # 基本実行ポリシーをアタッチ
        aws iam attach-role-policy \
            --role-name "$role_name" \
            --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
            --profile "$AWS_PROFILE"
        
        # Vector Database用のポリシーを作成
        cat > /tmp/vector-db-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "aoss:APIAccessAll",
        "es:ESHttpGet",
        "es:ESHttpPost",
        "es:ESHttpPut",
        "rds-db:connect",
        "s3:GetObject",
        "s3:PutObject",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "batch:DescribeJobs",
        "batch:SubmitJob",
        "bedrock:InvokeModel",
        "bedrock:ListFoundationModels"
      ],
      "Resource": "*"
    }
  ]
}
EOF

        # Vector Database用ポリシーを作成してアタッチ
        local account_id
        account_id=$(aws sts get-caller-identity --profile "$AWS_PROFILE" --query Account --output text)
        
        if aws iam create-policy \
            --policy-name "VectorDbLambdaPolicy" \
            --policy-document file:///tmp/vector-db-policy.json \
            --profile "$AWS_PROFILE" >/dev/null 2>&1; then
            log_info "Vector Database用ポリシーを作成しました"
        else
            log_info "Vector Database用ポリシーは既に存在します"
        fi
        
        aws iam attach-role-policy \
            --role-name "$role_name" \
            --policy-arn "arn:aws:iam::${account_id}:policy/VectorDbLambdaPolicy" \
            --profile "$AWS_PROFILE" >/dev/null 2>&1 || true
        
        role_arn=$(aws iam get-role --role-name "$role_name" --profile "$AWS_PROFILE" --query 'Role.Arn' --output text)
        
        # 少し待機してロールが利用可能になるまで待つ
        sleep 10
        
        log_success "IAMロールを作成しました: $role_arn"
    fi
    
    echo "$role_arn"
}

# Lambda関数のデプロイ
deploy_lambda_function() {
    local lambda_dir="$1"
    local role_arn="$2"
    
    log_info "Lambda関数をデプロイ中..."
    
    # Lambda関数名の生成（64文字制限対応）
    local function_name="${PROJECT_NAME}-${ENVIRONMENT}-vector-db-integration"
    if [[ ${#function_name} -gt 64 ]]; then
        # 長すぎる場合は短縮
        local short_project_name="${PROJECT_NAME:0:20}"
        local short_env="${ENVIRONMENT:0:10}"
        function_name="${short_project_name}-${short_env}-vector-db"
        log_warning "関数名を短縮しました: $function_name"
    fi
    
    # 環境変数を設定
    local env_vars="Variables={"
    env_vars="${env_vars}BEDROCK_REGION=${REGION}"
    
    if [[ "$OPENSEARCH_SERVERLESS_ENABLED" == "true" ]]; then
        env_vars="${env_vars},OPENSEARCH_SERVERLESS_ENDPOINT=${OPENSEARCH_SERVERLESS_ENDPOINT}"
        env_vars="${env_vars},OPENSEARCH_SERVERLESS_COLLECTION_ID=${OPENSEARCH_SERVERLESS_COLLECTION_ID}"
        env_vars="${env_vars},OPENSEARCH_SERVERLESS_INDEX=${OPENSEARCH_SERVERLESS_INDEX}"
        env_vars="${env_vars},VECTOR_DB_TYPE=opensearch-serverless"
    else
        env_vars="${env_vars},VECTOR_DB_TYPE=none"
    fi
    
    env_vars="${env_vars}}"
    
    cd "$lambda_dir"
    
    # 既存の関数があるかチェック
    if aws lambda get-function --function-name "$function_name" --profile "$AWS_PROFILE" --region "$REGION" >/dev/null 2>&1; then
        log_info "既存のLambda関数を更新中..."
        
        # 関数コードを更新
        aws lambda update-function-code \
            --function-name "$function_name" \
            --zip-file fileb://function.zip \
            --profile "$AWS_PROFILE" \
            --region "$REGION" >/dev/null
        
        # 環境変数を更新
        aws lambda update-function-configuration \
            --function-name "$function_name" \
            --environment "$env_vars" \
            --profile "$AWS_PROFILE" \
            --region "$REGION" >/dev/null
        
        log_success "Lambda関数を更新しました: $function_name"
    else
        log_info "新しいLambda関数を作成中..."
        
        # Lambda関数を作成
        aws lambda create-function \
            --function-name "$function_name" \
            --runtime nodejs20.x \
            --role "$role_arn" \
            --handler index.handler \
            --zip-file fileb://function.zip \
            --timeout 30 \
            --memory-size 512 \
            --environment "$env_vars" \
            --profile "$AWS_PROFILE" \
            --region "$REGION" >/dev/null
        
        log_success "Lambda関数を作成しました: $function_name"
    fi
    
    echo "$function_name"
}

# Lambda関数のテスト
test_lambda_function() {
    local function_name="$1"
    
    log_info "Lambda関数をテスト中..."
    
    # ヘルスチェックテスト
    log_info "ヘルスチェックテストを実行中..."
    local health_payload='{"action": "health_check"}'
    local health_payload_b64
    health_payload_b64=$(echo "$health_payload" | base64 -w 0 2>/dev/null || echo "$health_payload" | base64)
    
    local health_result=$(aws lambda invoke \
        --function-name "$function_name" \
        --payload "$health_payload_b64" \
        --profile "$AWS_PROFILE" \
        --region "$REGION" \
        /tmp/health-response.json 2>/dev/null || echo "failed")
    
    if [[ "$health_result" != "failed" ]]; then
        log_success "ヘルスチェックテストが成功しました"
        log_info "レスポンス:"
        cat /tmp/health-response.json | jq '.' 2>/dev/null || cat /tmp/health-response.json
        echo ""
    else
        log_error "ヘルスチェックテストが失敗しました"
    fi
    
    # Vector Database設定テスト
    log_info "Vector Database設定テストを実行中..."
    local config_payload='{"action": "get_vector_db_config"}'
    local config_payload_b64
    config_payload_b64=$(echo "$config_payload" | base64 -w 0 2>/dev/null || echo "$config_payload" | base64)
    
    local config_result=$(aws lambda invoke \
        --function-name "$function_name" \
        --payload "$config_payload_b64" \
        --profile "$AWS_PROFILE" \
        --region "$REGION" \
        /tmp/config-response.json 2>/dev/null || echo "failed")
    
    if [[ "$config_result" != "failed" ]]; then
        log_success "Vector Database設定テストが成功しました"
        log_info "レスポンス:"
        cat /tmp/config-response.json | jq '.' 2>/dev/null || cat /tmp/config-response.json
        echo ""
    else
        log_error "Vector Database設定テストが失敗しました"
    fi
    
    # Vector Database接続テスト
    log_info "Vector Database接続テストを実行中..."
    local connection_payload='{"action": "test_vector_db"}'
    local connection_payload_b64
    connection_payload_b64=$(echo "$connection_payload" | base64 -w 0 2>/dev/null || echo "$connection_payload" | base64)
    
    local connection_result=$(aws lambda invoke \
        --function-name "$function_name" \
        --payload "$connection_payload_b64" \
        --profile "$AWS_PROFILE" \
        --region "$REGION" \
        /tmp/connection-response.json 2>/dev/null || echo "failed")
    
    if [[ "$connection_result" != "failed" ]]; then
        log_success "Vector Database接続テストが成功しました"
        log_info "レスポンス:"
        cat /tmp/connection-response.json | jq '.' 2>/dev/null || cat /tmp/connection-response.json
        echo ""
    else
        log_error "Vector Database接続テストが失敗しました"
    fi
}

# メイン実行
main() {
    log_info "Vector Database統合Lambda関数のデプロイを開始します"
    
    # 前提条件の確認
    if ! command -v jq >/dev/null 2>&1; then
        log_error "jqコマンドが必要です。インストールしてください。"
        exit 1
    fi
    
    if ! command -v aws >/dev/null 2>&1; then
        log_error "AWS CLIが必要です。インストールしてください。"
        exit 1
    fi
    
    if ! command -v npm >/dev/null 2>&1; then
        log_error "Node.js/npmが必要です。インストールしてください。"
        exit 1
    fi
    
    # AWS認証の確認
    if ! aws sts get-caller-identity --profile "$AWS_PROFILE" >/dev/null 2>&1; then
        log_error "AWS認証が設定されていません"
        exit 1
    fi
    
    # Lambda関数の準備
    local lambda_dir=$(prepare_lambda_function)
    
    # IAM実行ロールの作成
    local role_arn=$(create_execution_role)
    
    # Lambda関数のデプロイ
    local function_name=$(deploy_lambda_function "$lambda_dir" "$role_arn")
    
    # 少し待機してからテスト
    sleep 5
    
    # Lambda関数のテスト
    test_lambda_function "$function_name"
    
    # 機密情報のクリア
    unset OPENSEARCH_SERVERLESS_ENDPOINT
    unset OPENSEARCH_SERVERLESS_COLLECTION_ID
    unset AWS_PROFILE
    
    # 一時ファイルのセキュアな削除は cleanup() 関数で実行される
    
    log_success "Vector Database統合Lambda関数のデプロイが完了しました！"
    log_info "関数名: $function_name"
    log_info "リージョン: $REGION"
    
    if [[ "$OPENSEARCH_SERVERLESS_ENABLED" == "true" ]]; then
        log_info "OpenSearch Serverless統合が有効です"
        log_info "エンドポイント: $OPENSEARCH_SERVERLESS_ENDPOINT"
    fi
}

# スクリプト実行
main "$@"