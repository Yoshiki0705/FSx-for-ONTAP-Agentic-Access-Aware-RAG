#!/bin/bash

# Lambda関数のVector Database統合テストスクリプト
# 実装したVector Database統合機能をテストします

set -euo pipefail

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 設定ファイルの読み込み
CONFIG_FILE="${PROJECT_ROOT}/config/deployment-config.json"
AWS_PROFILE="${AWS_PROFILE:-user01}"
AWS_REGION="${AWS_REGION:-ap-northeast-1}"
LAMBDA_TIMEOUT="${LAMBDA_TIMEOUT:-30}"
LAMBDA_MEMORY="${LAMBDA_MEMORY:-256}"

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

# Lambda関数の作成とテスト
create_test_lambda() {
    log_info "テスト用Lambda関数を作成中..."
    
    # Lambda関数のコードを準備
    local lambda_dir="/tmp/test-lambda-vector-db"
    mkdir -p "$lambda_dir"
    
    # package.jsonを作成
    cat > "$lambda_dir/package.json" << 'EOF'
{
  "name": "test-vector-db-lambda",
  "version": "1.0.0",
  "description": "Test Lambda for Vector Database Integration",
  "main": "index.js",
  "type": "module",
  "dependencies": {
    "@aws-sdk/client-bedrock-runtime": "^3.450.0",
    "@aws-sdk/client-s3": "^3.450.0",
    "@aws-sdk/client-dynamodb": "^3.450.0",
    "@aws-sdk/lib-dynamodb": "^3.450.0",
    "@aws-sdk/client-batch": "^3.450.0",
    "@aws-sdk/client-opensearch": "^3.450.0",
    "@aws-sdk/client-rds": "^3.450.0"
  }
}
EOF

    # Lambda関数のコードをコピー
    cp "$PROJECT_ROOT/lambda/embedding-generator/index.js" "$lambda_dir/"
    
    # 依存関係をインストール
    cd "$lambda_dir"
    npm install --production
    
    # ZIPファイルを作成
    zip -r function.zip . -x "*.git*" "*.DS_Store*"
    
    log_success "Lambda関数パッケージを作成しました"
    
    # Lambda関数を作成
    local function_name="test-vector-db-integration-$(date +%s)"
    
    # AWSアカウントIDを動的に取得
    local account_id=$(aws sts get-caller-identity --profile user01 --query Account --output text)
    local role_arn="arn:aws:iam::${account_id}:role/lambda-execution-role"
    
    # 実行ロールが存在しない場合は作成
    if ! aws iam get-role --role-name lambda-execution-role --profile user01 >/dev/null 2>&1; then
        log_info "Lambda実行ロールを作成中..."
        
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
            --role-name lambda-execution-role \
            --assume-role-policy-document file:///tmp/trust-policy.json \
            --profile user01
        
        # 基本実行ポリシーをアタッチ
        aws iam attach-role-policy \
            --role-name lambda-execution-role \
            --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
            --profile user01
        
        # Vector Database接続用のカスタムポリシーを作成
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
        "secretsmanager:GetSecretValue",
        "bedrock:InvokeModel",
        "s3:GetObject",
        "s3:PutObject",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "batch:SubmitJob"
      ],
      "Resource": "*"
    }
  ]
}
EOF
        
        # カスタムポリシーを作成してアタッチ
        aws iam create-policy \
            --policy-name VectorDatabaseTestPolicy \
            --policy-document file:///tmp/vector-db-policy.json \
            --profile user01 >/dev/null 2>&1 || true
        
        aws iam attach-role-policy \
            --role-name lambda-execution-role \
            --policy-arn "arn:aws:iam::178625946981:policy/VectorDatabaseTestPolicy" \
            --profile user01 >/dev/null 2>&1 || true
        
        # 少し待機
        sleep 10
    fi
    
    # Lambda関数を作成
    log_info "Lambda関数を作成中: $function_name"
    
    if ! aws lambda create-function \
        --function-name "$function_name" \
        --runtime nodejs20.x \
        --role "$role_arn" \
        --handler index.handler \
        --zip-file fileb://function.zip \
        --timeout "$LAMBDA_TIMEOUT" \
        --memory-size "$LAMBDA_MEMORY" \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" >/dev/null 2>&1; then
        log_error "Lambda関数の作成に失敗しました"
        return 1
    fi
    
    log_success "Lambda関数を作成しました: $function_name"
    
    # 関数名を返す
    echo "$function_name"
}

# 個別テスト関数
run_health_check_test() {
    local function_name="$1"
    log_info "ヘルスチェックテストを実行中..."
    
    local health_payload='{"action": "health_check"}'
    local health_result=$(aws lambda invoke \
        --function-name "$function_name" \
        --payload "$health_payload" \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" \
        /tmp/health-response.json 2>/dev/null || echo "failed")
    
    if [[ "$health_result" != "failed" ]]; then
        log_success "ヘルスチェックテストが成功しました"
        log_info "レスポンス:"
        cat /tmp/health-response.json | jq '.' 2>/dev/null || cat /tmp/health-response.json
        echo ""
        return 0
    else
        log_error "ヘルスチェックテストが失敗しました"
        return 1
    fi
}

run_config_test() {
    local function_name="$1"
    log_info "Vector Database設定テストを実行中..."
    
    local config_payload='{"action": "get_vector_db_config"}'
    local config_result=$(aws lambda invoke \
        --function-name "$function_name" \
        --payload "$config_payload" \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" \
        /tmp/config-response.json 2>/dev/null || echo "failed")
    
    if [[ "$config_result" != "failed" ]]; then
        log_success "Vector Database設定テストが成功しました"
        log_info "レスポンス:"
        cat /tmp/config-response.json | jq '.' 2>/dev/null || cat /tmp/config-response.json
        echo ""
        return 0
    else
        log_error "Vector Database設定テストが失敗しました"
        return 1
    fi
}

run_connection_test() {
    local function_name="$1"
    log_info "Vector Database接続テストを実行中..."
    
    local connection_payload='{"action": "test_vector_db"}'
    local connection_result=$(aws lambda invoke \
        --function-name "$function_name" \
        --payload "$connection_payload" \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" \
        /tmp/connection-response.json 2>/dev/null || echo "failed")
    
    if [[ "$connection_result" != "failed" ]]; then
        log_success "Vector Database接続テストが成功しました"
        log_info "レスポンス:"
        cat /tmp/connection-response.json | jq '.' 2>/dev/null || cat /tmp/connection-response.json
        echo ""
        return 0
    else
        log_error "Vector Database接続テストが失敗しました"
        return 1
    fi
}

# Lambda関数のテスト（並列実行対応）
test_lambda_function() {
    local function_name="$1"
    local test_results=0
    
    log_info "Lambda関数をテスト中: $function_name"
    
    # 各テストを順次実行（Lambda同時実行制限を考慮）
    if ! run_health_check_test "$function_name"; then
        ((test_results++))
    fi
    
    if ! run_config_test "$function_name"; then
        ((test_results++))
    fi
    
    if ! run_connection_test "$function_name"; then
        ((test_results++))
    fi
    
    return $test_results
}

# Lambda関数のクリーンアップ
cleanup_lambda() {
    local function_name="$1"
    
    if [[ -n "$function_name" ]]; then
        log_info "Lambda関数を削除中: $function_name"
        
        aws lambda delete-function \
            --function-name "$function_name" \
            --profile user01 \
            --region ap-northeast-1 >/dev/null 2>&1 || true
        
        log_success "Lambda関数を削除しました"
    fi
    
    # 一時ファイルをクリーンアップ
    rm -rf /tmp/test-lambda-vector-db
    rm -f /tmp/health-response.json /tmp/config-response.json /tmp/connection-response.json
    rm -f /tmp/trust-policy.json /tmp/vector-db-policy.json
    
    # テスト用IAMポリシーのクリーンアップ（オプション）
    if [[ "${CLEANUP_IAM_POLICY:-false}" == "true" ]]; then
        log_info "テスト用IAMポリシーを削除中..."
        aws iam detach-role-policy \
            --role-name lambda-execution-role \
            --policy-arn "arn:aws:iam::$(aws sts get-caller-identity --profile "$AWS_PROFILE" --query Account --output text):policy/VectorDatabaseTestPolicy" \
            --profile "$AWS_PROFILE" >/dev/null 2>&1 || true
        
        aws iam delete-policy \
            --policy-arn "arn:aws:iam::$(aws sts get-caller-identity --profile "$AWS_PROFILE" --query Account --output text):policy/VectorDatabaseTestPolicy" \
            --profile "$AWS_PROFILE" >/dev/null 2>&1 || true
    fi
}

# メイン実行
main() {
    log_info "Lambda関数Vector Database統合テストを開始します"
    
    # 前提条件の確認
    if ! command -v aws >/dev/null 2>&1; then
        log_error "AWS CLIが必要です。インストールしてください。"
        exit 1
    fi
    
    if ! command -v jq >/dev/null 2>&1; then
        log_error "jqコマンドが必要です。インストールしてください。"
        exit 1
    fi
    
    if ! command -v npm >/dev/null 2>&1; then
        log_error "Node.js/npmが必要です。インストールしてください。"
        exit 1
    fi
    
    # AWS認証の確認
    if ! aws sts get-caller-identity --profile "$AWS_PROFILE" >/dev/null 2>&1; then
        log_error "AWS認証が設定されていません (プロファイル: $AWS_PROFILE)"
        exit 1
    fi
    
    # 設定ファイルの確認
    if [[ -f "$CONFIG_FILE" ]]; then
        log_info "設定ファイルを検出しました: $CONFIG_FILE"
        # Vector Database設定の確認
        if jq -e '.vectorDatabases' "$CONFIG_FILE" >/dev/null 2>&1; then
            log_info "Vector Database設定が見つかりました"
        else
            log_warning "Vector Database設定が見つかりません。デフォルト設定を使用します"
        fi
    else
        log_warning "設定ファイルが見つかりません: $CONFIG_FILE"
    fi
    
    local function_name=""
    local test_results=0
    
    # トラップを設定してクリーンアップを確実に実行
    trap 'cleanup_lambda "$function_name"' EXIT
    
    # Lambda関数を作成
    function_name=$(create_test_lambda)
    
    if [[ -n "$function_name" ]]; then
        # 少し待機してから関数をテスト
        log_info "Lambda関数の準備完了を待機中..."
        sleep 5
        
        if test_lambda_function "$function_name"; then
            log_success "すべてのテストが成功しました！"
        else
            log_error "一部のテストで問題が検出されました"
            test_results=1
        fi
    else
        log_error "Lambda関数の作成に失敗しました"
        exit 1
    fi
    
    # 結果の表示
    if [[ $test_results -eq 0 ]]; then
        log_success "Lambda関数Vector Database統合テストが完了しました！"
    else
        log_error "テストで問題が検出されました。ログを確認してください。"
        exit 1
    fi
}

# スクリプト実行
main "$@"