#!/bin/bash

# Vector Database統合テストスクリプト
# 外部Vector Databaseとの接続をテストします

set -euo pipefail

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 設定ファイルの読み込み
CONFIG_FILE="${PROJECT_ROOT}/config/deployment-config.json"
if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "❌ 設定ファイルが見つかりません: $CONFIG_FILE"
    exit 1
fi

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

# Vector Database設定の確認
check_vector_db_config() {
    log_info "Vector Database設定を確認中..."
    
    # 設定ファイルからVector Database設定を抽出
    local opensearch_serverless_enabled=$(jq -r '.vectorDatabases.opensearchServerless.enabled // false' "$CONFIG_FILE")
    local opensearch_enabled=$(jq -r '.vectorDatabases.opensearch.enabled // false' "$CONFIG_FILE")
    local aurora_enabled=$(jq -r '.vectorDatabases.aurora.enabled // false' "$CONFIG_FILE")
    
    if [[ "$opensearch_serverless_enabled" == "true" ]]; then
        log_info "OpenSearch Serverless設定が有効です"
        test_opensearch_serverless_config
    fi
    
    if [[ "$opensearch_enabled" == "true" ]]; then
        log_info "OpenSearch設定が有効です"
        test_opensearch_config
    fi
    
    if [[ "$aurora_enabled" == "true" ]]; then
        log_info "Aurora PostgreSQL設定が有効です"
        test_aurora_config
    fi
    
    if [[ "$opensearch_serverless_enabled" == "false" && "$opensearch_enabled" == "false" && "$aurora_enabled" == "false" ]]; then
        log_warning "Vector Databaseが設定されていません"
        return 1
    fi
}

# OpenSearch Serverless設定テスト
test_opensearch_serverless_config() {
    log_info "OpenSearch Serverless設定をテスト中..."
    
    local endpoint=$(jq -r '.vectorDatabases.opensearchServerless.external.collectionEndpoint // ""' "$CONFIG_FILE")
    local collection_id=$(jq -r '.vectorDatabases.opensearchServerless.external.collectionId // ""' "$CONFIG_FILE")
    local index_name=$(jq -r '.vectorDatabases.opensearchServerless.external.indexName // "embeddings"' "$CONFIG_FILE")
    
    if [[ -z "$endpoint" ]]; then
        log_error "OpenSearch Serverlessエンドポイントが設定されていません"
        return 1
    fi
    
    if [[ -z "$collection_id" ]]; then
        log_error "OpenSearch ServerlessコレクションIDが設定されていません"
        return 1
    fi
    
    log_success "OpenSearch Serverless設定: $endpoint"
    log_info "コレクションID: $collection_id"
    log_info "インデックス名: $index_name"
    
    # 接続テスト（簡易版）
    if command -v curl >/dev/null 2>&1; then
        log_info "接続テストを実行中..."
        if curl -s --connect-timeout 10 "$endpoint" >/dev/null 2>&1; then
            log_success "OpenSearch Serverlessへの接続が成功しました"
        else
            log_warning "OpenSearch Serverlessへの接続テストが失敗しました（認証が必要な可能性があります）"
        fi
    fi
}

# OpenSearch設定テスト
test_opensearch_config() {
    log_info "OpenSearch設定をテスト中..."
    
    local endpoint=$(jq -r '.vectorDatabases.opensearch.external.domainEndpoint // ""' "$CONFIG_FILE")
    local index_name=$(jq -r '.vectorDatabases.opensearch.external.indexName // "embeddings"' "$CONFIG_FILE")
    
    if [[ -z "$endpoint" ]]; then
        log_error "OpenSearchエンドポイントが設定されていません"
        return 1
    fi
    
    log_success "OpenSearch設定: $endpoint"
    log_info "インデックス名: $index_name"
    
    # 接続テスト（簡易版）
    if command -v curl >/dev/null 2>&1; then
        log_info "接続テストを実行中..."
        if curl -s --connect-timeout 10 "$endpoint" >/dev/null 2>&1; then
            log_success "OpenSearchへの接続が成功しました"
        else
            log_warning "OpenSearchへの接続テストが失敗しました（認証が必要な可能性があります）"
        fi
    fi
}

# Aurora PostgreSQL設定テスト
test_aurora_config() {
    log_info "Aurora PostgreSQL設定をテスト中..."
    
    local cluster_endpoint=$(jq -r '.vectorDatabases.aurora.external.clusterEndpoint // ""' "$CONFIG_FILE")
    local database_name=$(jq -r '.vectorDatabases.aurora.external.databaseName // ""' "$CONFIG_FILE")
    local port=$(jq -r '.vectorDatabases.aurora.external.port // 5432' "$CONFIG_FILE")
    local table_name=$(jq -r '.vectorDatabases.aurora.vectorExtension.tableName // "document_embeddings"' "$CONFIG_FILE")
    
    if [[ -z "$cluster_endpoint" ]]; then
        log_error "Aurora PostgreSQLクラスターエンドポイントが設定されていません"
        return 1
    fi
    
    if [[ -z "$database_name" ]]; then
        log_error "Aurora PostgreSQLデータベース名が設定されていません"
        return 1
    fi
    
    log_success "Aurora PostgreSQL設定: $cluster_endpoint"
    log_info "データベース名: $database_name"
    log_info "ポート: $port"
    log_info "テーブル名: $table_name"
    
    # 接続テスト（簡易版）
    if command -v nc >/dev/null 2>&1; then
        log_info "ポート接続テストを実行中..."
        if nc -z "${cluster_endpoint}" "${port}" 2>/dev/null; then
            log_success "Aurora PostgreSQLポートへの接続が成功しました"
        else
            log_warning "Aurora PostgreSQLポートへの接続テストが失敗しました"
        fi
    fi
}

# Lambda関数のVector Database統合テスト
test_lambda_vector_db_integration() {
    log_info "Lambda関数のVector Database統合をテスト中..."
    
    # スタック名を取得
    local stack_name=$(jq -r '.stackName // "embedding-workload-stack"' "$CONFIG_FILE")
    
    # Lambda関数名を取得
    local function_name="${stack_name}-EmbeddingGeneratorFunction"
    
    # Lambda関数の存在確認
    if ! aws lambda get-function --function-name "$function_name" >/dev/null 2>&1; then
        log_error "Lambda関数が見つかりません: $function_name"
        return 1
    fi
    
    log_success "Lambda関数が見つかりました: $function_name"
    
    # Vector Database設定テスト
    log_info "Vector Database設定テストを実行中..."
    local test_payload='{"action": "get_vector_db_config"}'
    
    local result=$(aws lambda invoke \
        --function-name "$function_name" \
        --payload "$test_payload" \
        --output json \
        /tmp/lambda-response.json 2>/dev/null || echo "failed")
    
    if [[ "$result" == "failed" ]]; then
        log_error "Lambda関数の呼び出しに失敗しました"
        return 1
    fi
    
    # レスポンスの確認
    if [[ -f "/tmp/lambda-response.json" ]]; then
        local response_body=$(cat /tmp/lambda-response.json)
        log_info "Lambda関数レスポンス:"
        echo "$response_body" | jq '.' 2>/dev/null || echo "$response_body"
        rm -f /tmp/lambda-response.json
    fi
    
    # Vector Database接続テスト
    log_info "Vector Database接続テストを実行中..."
    local connection_test_payload='{"action": "test_vector_db"}'
    
    local connection_result=$(aws lambda invoke \
        --function-name "$function_name" \
        --payload "$connection_test_payload" \
        --output json \
        /tmp/lambda-connection-test.json 2>/dev/null || echo "failed")
    
    if [[ "$connection_result" == "failed" ]]; then
        log_error "Vector Database接続テストに失敗しました"
        return 1
    fi
    
    # 接続テスト結果の確認
    if [[ -f "/tmp/lambda-connection-test.json" ]]; then
        local connection_response=$(cat /tmp/lambda-connection-test.json)
        log_info "Vector Database接続テスト結果:"
        echo "$connection_response" | jq '.' 2>/dev/null || echo "$connection_response"
        rm -f /tmp/lambda-connection-test.json
        
        # 成功判定
        local success=$(echo "$connection_response" | jq -r '.body' | jq -r '.success // false' 2>/dev/null || echo "false")
        if [[ "$success" == "true" ]]; then
            log_success "Vector Database接続テストが成功しました"
        else
            log_warning "Vector Database接続テストで問題が検出されました"
        fi
    fi
}

# AWS Batch ジョブのVector Database統合テスト
test_batch_vector_db_integration() {
    log_info "AWS BatchジョブのVector Database統合をテスト中..."
    
    # ジョブ定義の確認
    local job_definition_name="EmbeddingGenerationJobDefinition"
    
    if ! aws batch describe-job-definitions \
        --job-definition-name "$job_definition_name" \
        --status ACTIVE >/dev/null 2>&1; then
        log_error "Batchジョブ定義が見つかりません: $job_definition_name"
        return 1
    fi
    
    log_success "Batchジョブ定義が見つかりました: $job_definition_name"
    
    # ジョブ定義の環境変数確認
    log_info "ジョブ定義の環境変数を確認中..."
    local job_def_details=$(aws batch describe-job-definitions \
        --job-definition-name "$job_definition_name" \
        --status ACTIVE \
        --output json)
    
    local env_vars=$(echo "$job_def_details" | jq -r '.jobDefinitions[0].containerProperties.environment[]? | "\(.name)=\(.value)"' 2>/dev/null || echo "")
    
    if [[ -n "$env_vars" ]]; then
        log_info "環境変数:"
        echo "$env_vars" | grep -E "(OPENSEARCH|AURORA|VECTOR)" || log_info "Vector Database関連の環境変数が見つかりません"
    else
        log_warning "環境変数が設定されていません"
    fi
}

# メイン実行
main() {
    log_info "Vector Database統合テストを開始します"
    
    # 前提条件の確認
    if ! command -v jq >/dev/null 2>&1; then
        log_error "jqコマンドが必要です。インストールしてください。"
        exit 1
    fi
    
    if ! command -v aws >/dev/null 2>&1; then
        log_error "AWS CLIが必要です。インストールしてください。"
        exit 1
    fi
    
    # AWS認証の確認
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log_error "AWS認証が設定されていません"
        exit 1
    fi
    
    local test_results=0
    
    # 各テストの実行
    if ! check_vector_db_config; then
        ((test_results++))
    fi
    
    if ! test_lambda_vector_db_integration; then
        ((test_results++))
    fi
    
    if ! test_batch_vector_db_integration; then
        ((test_results++))
    fi
    
    # 結果の表示
    if [[ $test_results -eq 0 ]]; then
        log_success "すべてのVector Database統合テストが成功しました！"
    else
        log_error "$test_results 個のテストで問題が検出されました"
        exit 1
    fi
}

# スクリプト実行
main "$@"
# Ope
nSearch Serverless接続テスト
test_opensearch_serverless_connection() {
    log_info "OpenSearch Serverless接続テスト実行中..."
    
    local endpoint=$(jq -r '.vectorDatabases.opensearchServerless.external.collectionEndpoint // ""' "$CONFIG_FILE")
    local collection_id=$(jq -r '.vectorDatabases.opensearchServerless.external.collectionId // ""' "$CONFIG_FILE")
    local index_name=$(jq -r '.vectorDatabases.opensearchServerless.external.indexName // "embedding-documents"' "$CONFIG_FILE")
    
    if [[ -z "$endpoint" || -z "$collection_id" ]]; then
        log_warning "OpenSearch Serverless設定が不完全です"
        return 1
    fi
    
    # Lambda関数を呼び出してテスト
    local payload=$(cat << EOF
{
    "action": "test_opensearch_serverless",
    "endpoint": "$endpoint",
    "collectionId": "$collection_id",
    "indexName": "$index_name"
}
EOF
)
    
    local result=$(aws lambda invoke \
        --function-name "${LAMBDA_FUNCTION_NAME}" \
        --payload "$payload" \
        --cli-binary-format raw-in-base64-out \
        /tmp/opensearch-serverless-test.json 2>&1)
    
    if [[ $? -eq 0 ]]; then
        local response=$(cat /tmp/opensearch-serverless-test.json)
        local success=$(echo "$response" | jq -r '.success // false')
        
        if [[ "$success" == "true" ]]; then
            log_success "OpenSearch Serverless接続テスト成功"
            return 0
        else
            local error_msg=$(echo "$response" | jq -r '.error // "不明なエラー"')
            log_error "OpenSearch Serverless接続テスト失敗: $error_msg"
            return 1
        fi
    else
        log_error "Lambda関数呼び出し失敗: $result"
        return 1
    fi
}

# OpenSearch Service接続テスト
test_opensearch_service_connection() {
    log_info "OpenSearch Service接続テスト実行中..."
    
    local endpoint=$(jq -r '.vectorDatabases.opensearch.external.domainEndpoint // ""' "$CONFIG_FILE")
    local domain_name=$(jq -r '.vectorDatabases.opensearch.external.domainName // ""' "$CONFIG_FILE")
    local index_name=$(jq -r '.vectorDatabases.opensearch.external.indexName // "embedding-documents"' "$CONFIG_FILE")
    
    if [[ -z "$endpoint" || -z "$domain_name" ]]; then
        log_warning "OpenSearch Service設定が不完全です"
        return 1
    fi
    
    # Lambda関数を呼び出してテスト
    local payload=$(cat << EOF
{
    "action": "test_opensearch_service",
    "endpoint": "$endpoint",
    "domainName": "$domain_name",
    "indexName": "$index_name"
}
EOF
)
    
    local result=$(aws lambda invoke \
        --function-name "${LAMBDA_FUNCTION_NAME}" \
        --payload "$payload" \
        --cli-binary-format raw-in-base64-out \
        /tmp/opensearch-service-test.json 2>&1)
    
    if [[ $? -eq 0 ]]; then
        local response=$(cat /tmp/opensearch-service-test.json)
        local success=$(echo "$response" | jq -r '.success // false')
        
        if [[ "$success" == "true" ]]; then
            log_success "OpenSearch Service接続テスト成功"
            return 0
        else
            local error_msg=$(echo "$response" | jq -r '.error // "不明なエラー"')
            log_error "OpenSearch Service接続テスト失敗: $error_msg"
            return 1
        fi
    else
        log_error "Lambda関数呼び出し失敗: $result"
        return 1
    fi
}

# Aurora PostgreSQL接続テスト
test_aurora_postgresql_connection() {
    log_info "Aurora PostgreSQL接続テスト実行中..."
    
    local cluster_endpoint=$(jq -r '.vectorDatabases.aurora.external.clusterEndpoint // ""' "$CONFIG_FILE")
    local cluster_id=$(jq -r '.vectorDatabases.aurora.external.clusterIdentifier // ""' "$CONFIG_FILE")
    local database_name=$(jq -r '.vectorDatabases.aurora.external.databaseName // "embeddings"' "$CONFIG_FILE")
    local username=$(jq -r '.vectorDatabases.aurora.external.authentication.username // "embedding_user"' "$CONFIG_FILE")
    
    if [[ -z "$cluster_endpoint" || -z "$cluster_id" ]]; then
        log_warning "Aurora PostgreSQL設定が不完全です"
        return 1
    fi
    
    # Lambda関数を呼び出してテスト
    local payload=$(cat << EOF
{
    "action": "test_aurora_postgresql",
    "clusterEndpoint": "$cluster_endpoint",
    "clusterIdentifier": "$cluster_id",
    "databaseName": "$database_name",
    "username": "$username"
}
EOF
)
    
    local result=$(aws lambda invoke \
        --function-name "${LAMBDA_FUNCTION_NAME}" \
        --payload "$payload" \
        --cli-binary-format raw-in-base64-out \
        /tmp/aurora-postgresql-test.json 2>&1)
    
    if [[ $? -eq 0 ]]; then
        local response=$(cat /tmp/aurora-postgresql-test.json)
        local success=$(echo "$response" | jq -r '.success // false')
        
        if [[ "$success" == "true" ]]; then
            log_success "Aurora PostgreSQL接続テスト成功"
            return 0
        else
            local error_msg=$(echo "$response" | jq -r '.error // "不明なエラー"')
            log_error "Aurora PostgreSQL接続テスト失敗: $error_msg"
            return 1
        fi
    else
        log_error "Lambda関数呼び出し失敗: $result"
        return 1
    fi
}

# 全Vector Database接続テスト
test_all_vector_databases() {
    log_info "全Vector Database接続テストを開始..."
    
    local success_count=0
    local total_count=0
    
    # OpenSearch Serverless
    local opensearch_serverless_enabled=$(jq -r '.vectorDatabases.opensearchServerless.enabled // false' "$CONFIG_FILE")
    if [[ "$opensearch_serverless_enabled" == "true" ]]; then
        ((total_count++))
        if test_opensearch_serverless_connection; then
            ((success_count++))
        fi
    fi
    
    # OpenSearch Service
    local opensearch_enabled=$(jq -r '.vectorDatabases.opensearch.enabled // false' "$CONFIG_FILE")
    if [[ "$opensearch_enabled" == "true" ]]; then
        ((total_count++))
        if test_opensearch_service_connection; then
            ((success_count++))
        fi
    fi
    
    # Aurora PostgreSQL
    local aurora_enabled=$(jq -r '.vectorDatabases.aurora.enabled // false' "$CONFIG_FILE")
    if [[ "$aurora_enabled" == "true" ]]; then
        ((total_count++))
        if test_aurora_postgresql_connection; then
            ((success_count++))
        fi
    fi
    
    # 結果表示
    log_info "Vector Database接続テスト完了: $success_count/$total_count 成功"
    
    if [[ $success_count -eq $total_count && $total_count -gt 0 ]]; then
        log_success "全てのVector Database接続テストが成功しました"
        return 0
    else
        log_error "一部のVector Database接続テストが失敗しました"
        return 1
    fi
}

# メイン実行
main() {
    # Lambda関数名の設定
    LAMBDA_FUNCTION_NAME="${1:-embedding-generator}"
    
    log_info "Vector Database統合テストを開始します"
    log_info "Lambda関数名: $LAMBDA_FUNCTION_NAME"
    
    # 設定確認
    check_vector_db_config
    
    # 接続テスト実行
    test_all_vector_databases
    
    # クリーンアップ
    rm -f /tmp/opensearch-serverless-test.json
    rm -f /tmp/opensearch-service-test.json
    rm -f /tmp/aurora-postgresql-test.json
    
    log_success "Vector Database統合テスト完了"
}

# スクリプト実行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
# マルチコ
ンピュートタイプでのVector Database統合テスト
test_multicompute_vector_db_integration() {
    log_info "マルチコンピュートタイプでのVector Database統合テストを開始"
    
    local compute_types=("batch" "spot-fleet" "ecs")
    local test_results=()
    
    for compute_type in "${compute_types[@]}"; do
        log_info "コンピュートタイプ: $compute_type でのテスト開始"
        
        # Lambda関数を使用してテスト実行
        local test_payload=$(cat << EOF
{
    "action": "test_vector_db_integration",
    "computeType": "$compute_type",
    "testFile": "/mnt/fsx-data/test/sample_multimodal.jpg",
    "options": {
        "dimensions": 1024,
        "userId": "test-user"
    }
}
EOF
)
        
        # Lambda関数呼び出し
        local result
        if result=$(aws lambda invoke \
            --function-name "${LAMBDA_FUNCTION_NAME:-embedding-generator}" \
            --payload "$test_payload" \
            --cli-binary-format raw-in-base64-out \
            /tmp/vector-db-test-result.json 2>&1); then
            
            local response_body
            response_body=$(cat /tmp/vector-db-test-result.json)
            
            if echo "$response_body" | jq -e '.success == true' &> /dev/null; then
                log_success "$compute_type: Vector Database統合テスト成功"
                test_results+=("$compute_type:SUCCESS")
            else
                local error_msg
                error_msg=$(echo "$response_body" | jq -r '.error // "不明なエラー"')
                log_error "$compute_type: Vector Database統合テスト失敗 - $error_msg"
                test_results+=("$compute_type:FAILED")
            fi
        else
            log_error "$compute_type: Lambda呼び出し失敗 - $result"
            test_results+=("$compute_type:ERROR")
        fi
        
        sleep 5  # 次のテストまで少し待機
    done
    
    # 結果サマリー
    log_info "マルチコンピュートタイプテスト結果:"
    for result in "${test_results[@]}"; do
        local compute_type="${result%%:*}"
        local status="${result##*:}"
        
        case "$status" in
            "SUCCESS")
                log_success "$compute_type: 成功"
                ;;
            "FAILED")
                log_error "$compute_type: 失敗"
                ;;
            "ERROR")
                log_error "$compute_type: エラー"
                ;;
        esac
    done
}

# Vector Database別テスト
test_vector_db_by_type() {
    local db_type="$1"
    log_info "$db_type Vector Databaseテストを開始"
    
    case "$db_type" in
        "opensearch-serverless")
            test_opensearch_serverless_integration
            ;;
        "opensearch")
            test_opensearch_integration
            ;;
        "aurora-postgresql")
            test_aurora_postgresql_integration
            ;;
        *)
            log_error "サポートされていないVector Databaseタイプ: $db_type"
            return 1
            ;;
    esac
}

test_opensearch_serverless_integration() {
    log_info "OpenSearch Serverless統合テスト実行中"
    
    local endpoint=$(jq -r '.vectorDatabases.opensearchServerless.external.collectionEndpoint // empty' "$CONFIG_FILE")
    local collection_id=$(jq -r '.vectorDatabases.opensearchServerless.external.collectionId // empty' "$CONFIG_FILE")
    local index_name=$(jq -r '.vectorDatabases.opensearchServerless.external.indexName // "embeddings"' "$CONFIG_FILE")
    
    if [[ -z "$endpoint" || -z "$collection_id" ]]; then
        log_error "OpenSearch Serverless設定が不完全です"
        return 1
    fi
    
    # 接続テスト用のペイロード
    local test_payload=$(cat << EOF
{
    "action": "test_opensearch_serverless_connection",
    "endpoint": "$endpoint",
    "collectionId": "$collection_id",
    "indexName": "$index_name"
}
EOF
)
    
    # テスト実行
    if aws lambda invoke \
        --function-name "${LAMBDA_FUNCTION_NAME:-embedding-generator}" \
        --payload "$test_payload" \
        --cli-binary-format raw-in-base64-out \
        /tmp/opensearch-serverless-test.json &> /dev/null; then
        
        local response_body
        response_body=$(cat /tmp/opensearch-serverless-test.json)
        
        if echo "$response_body" | jq -e '.success == true' &> /dev/null; then
            log_success "OpenSearch Serverless接続テスト成功"
            return 0
        else
            local error_msg
            error_msg=$(echo "$response_body" | jq -r '.error // "不明なエラー"')
            log_error "OpenSearch Serverless接続テスト失敗: $error_msg"
            return 1
        fi
    else
        log_error "OpenSearch Serverless接続テスト実行失敗"
        return 1
    fi
}

test_opensearch_integration() {
    log_info "OpenSearch Service統合テスト実行中"
    
    local endpoint=$(jq -r '.vectorDatabases.opensearch.external.domainEndpoint // empty' "$CONFIG_FILE")
    local domain_name=$(jq -r '.vectorDatabases.opensearch.external.domainName // empty' "$CONFIG_FILE")
    local index_name=$(jq -r '.vectorDatabases.opensearch.external.indexName // "embeddings"' "$CONFIG_FILE")
    
    if [[ -z "$endpoint" || -z "$domain_name" ]]; then
        log_error "OpenSearch Service設定が不完全です"
        return 1
    fi
    
    # 接続テスト用のペイロード
    local test_payload=$(cat << EOF
{
    "action": "test_opensearch_connection",
    "endpoint": "$endpoint",
    "domainName": "$domain_name",
    "indexName": "$index_name"
}
EOF
)
    
    # テスト実行
    if aws lambda invoke \
        --function-name "${LAMBDA_FUNCTION_NAME:-embedding-generator}" \
        --payload "$test_payload" \
        --cli-binary-format raw-in-base64-out \
        /tmp/opensearch-test.json &> /dev/null; then
        
        local response_body
        response_body=$(cat /tmp/opensearch-test.json)
        
        if echo "$response_body" | jq -e '.success == true' &> /dev/null; then
            log_success "OpenSearch Service接続テスト成功"
            return 0
        else
            local error_msg
            error_msg=$(echo "$response_body" | jq -r '.error // "不明なエラー"')
            log_error "OpenSearch Service接続テスト失敗: $error_msg"
            return 1
        fi
    else
        log_error "OpenSearch Service接続テスト実行失敗"
        return 1
    fi
}

test_aurora_postgresql_integration() {
    log_info "Aurora PostgreSQL統合テスト実行中"
    
    local cluster_endpoint=$(jq -r '.vectorDatabases.aurora.external.clusterEndpoint // empty' "$CONFIG_FILE")
    local cluster_id=$(jq -r '.vectorDatabases.aurora.external.clusterIdentifier // empty' "$CONFIG_FILE")
    local database_name=$(jq -r '.vectorDatabases.aurora.external.databaseName // empty' "$CONFIG_FILE")
    
    if [[ -z "$cluster_endpoint" || -z "$cluster_id" || -z "$database_name" ]]; then
        log_error "Aurora PostgreSQL設定が不完全です"
        return 1
    fi
    
    # 接続テスト用のペイロード
    local test_payload=$(cat << EOF
{
    "action": "test_aurora_postgresql_connection",
    "clusterEndpoint": "$cluster_endpoint",
    "clusterIdentifier": "$cluster_id",
    "databaseName": "$database_name"
}
EOF
)
    
    # テスト実行
    if aws lambda invoke \
        --function-name "${LAMBDA_FUNCTION_NAME:-embedding-generator}" \
        --payload "$test_payload" \
        --cli-binary-format raw-in-base64-out \
        /tmp/aurora-test.json &> /dev/null; then
        
        local response_body
        response_body=$(cat /tmp/aurora-test.json)
        
        if echo "$response_body" | jq -e '.success == true' &> /dev/null; then
            log_success "Aurora PostgreSQL接続テスト成功"
            return 0
        else
            local error_msg
            error_msg=$(echo "$response_body" | jq -r '.error // "不明なエラー"')
            log_error "Aurora PostgreSQL接続テスト失敗: $error_msg"
            return 1
        fi
    else
        log_error "Aurora PostgreSQL接続テスト実行失敗"
        return 1
    fi
}

# メイン実行部分の拡張
main() {
    log_info "Vector Database統合テスト開始"
    
    # 基本設定確認
    check_vector_db_config
    
    # マルチコンピュートタイプテスト
    test_multicompute_vector_db_integration
    
    # Vector Database別テスト
    local enabled_dbs=()
    
    if [[ "$(jq -r '.vectorDatabases.opensearchServerless.enabled // false' "$CONFIG_FILE")" == "true" ]]; then
        enabled_dbs+=("opensearch-serverless")
    fi
    
    if [[ "$(jq -r '.vectorDatabases.opensearch.enabled // false' "$CONFIG_FILE")" == "true" ]]; then
        enabled_dbs+=("opensearch")
    fi
    
    if [[ "$(jq -r '.vectorDatabases.aurora.enabled // false' "$CONFIG_FILE")" == "true" ]]; then
        enabled_dbs+=("aurora-postgresql")
    fi
    
    for db_type in "${enabled_dbs[@]}"; do
        test_vector_db_by_type "$db_type"
    done
    
    log_success "Vector Database統合テスト完了"
}

# クリーンアップ
cleanup() {
    rm -f /tmp/vector-db-test-result.json
    rm -f /tmp/opensearch-serverless-test.json
    rm -f /tmp/opensearch-test.json
    rm -f /tmp/aurora-test.json
}

# シグナルハンドラの設定
trap cleanup EXIT

# メイン処理実行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi