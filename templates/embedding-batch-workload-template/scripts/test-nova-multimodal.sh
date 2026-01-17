#!/bin/bash

# Nova Multimodal Embeddingsテストスクリプト
# Amazon Nova Multimodal Embeddingsの機能をテストします

set -euo pipefail

# 設定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 設定ファイルの読み込み
CONFIG_FILE="${PROJECT_ROOT}/config/test-config.json"
if [[ -f "$CONFIG_FILE" ]]; then
    # 設定ファイルから値を読み込み（jqが利用可能な場合）
    if command -v jq >/dev/null 2>&1; then
        DEFAULT_REGION=$(jq -r '.testing.defaultRegion // "us-east-1"' "$CONFIG_FILE" 2>/dev/null || echo "us-east-1")
        DEFAULT_DIMENSIONS=$(jq -r '.testing.defaultDimensions // 1024' "$CONFIG_FILE" 2>/dev/null || echo "1024")
        LOG_LEVEL=$(jq -r '.testing.logLevel // "INFO"' "$CONFIG_FILE" 2>/dev/null || echo "INFO")
    else
        DEFAULT_REGION="us-east-1"
        DEFAULT_DIMENSIONS="1024"
        LOG_LEVEL="INFO"
    fi
else
    # デフォルト値
    DEFAULT_REGION="us-east-1"
    DEFAULT_DIMENSIONS="1024"
    LOG_LEVEL="INFO"
fi

LOG_FILE="$PROJECT_ROOT/logs/nova-multimodal-test-$(date +%Y%m%d-%H%M%S).log"

# ログディレクトリの作成
mkdir -p "$(dirname "$LOG_FILE")"

# ログ関数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" | tee -a "$LOG_FILE" >&2
}

# 使用方法の表示
show_usage() {
    cat << EOF
使用方法: $0 [オプション]

Nova Multimodal Embeddingsのテストを実行します。

オプション:
  -f, --function-name FUNCTION_NAME  Lambda関数名を指定
  -r, --region REGION               AWSリージョンを指定 (デフォルト: us-east-1)
  -t, --test-type TYPE              テストタイプを指定
  -d, --dimensions DIMENSIONS       埋め込み次元数を指定 (256|384|1024|3072)
  -v, --verbose                     詳細ログを出力
  -h, --help                        このヘルプを表示

テストタイプ:
  text        - テキスト埋め込みテスト
  image       - 画像埋め込みテスト
  video       - 動画埋め込みテスト
  audio       - 音声埋め込みテスト
  document    - 文書埋め込みテスト
  fsx         - FSx Nova Multimodal ジョブテスト
  batch       - バッチ処理テスト
  spot-fleet  - Spot Fleet処理テスト
  ecs         - ECS処理テスト
  all         - 全テスト実行

例:
  $0 --function-name embedding-generator --test-type text
  $0 --function-name embedding-generator --test-type all --dimensions 1024
  $0 --function-name embedding-generator --test-type spot-fleet --verbose

EOF
}

# デフォルト設定（設定ファイルから読み込み）
FUNCTION_NAME=""
REGION="$DEFAULT_REGION"
TEST_TYPE="text"
DIMENSIONS="$DEFAULT_DIMENSIONS"
VERBOSE=false

# ログレベルに応じた詳細出力設定
if [[ "$LOG_LEVEL" == "DEBUG" ]]; then
    VERBOSE=true
fi

# コマンドライン引数の解析
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--function-name)
            FUNCTION_NAME="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -t|--test-type)
            TEST_TYPE="$2"
            shift 2
            ;;
        -d|--dimensions)
            DIMENSIONS="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            error "不明なオプション: $1"
            show_usage
            exit 1
            ;;
    esac
done

# 必須パラメータの確認と入力値検証
if [[ -z "$FUNCTION_NAME" ]]; then
    error "Lambda関数名が指定されていません"
    show_usage
    exit 1
fi

# Lambda関数名の形式検証（英数字、ハイフン、アンダースコアのみ、64文字以内）
if [[ ! "$FUNCTION_NAME" =~ ^[a-zA-Z0-9_-]{1,64}$ ]]; then
    error "無効なLambda関数名形式: $FUNCTION_NAME"
    error "英数字、ハイフン、アンダースコアのみ使用可能（64文字以内）"
    exit 1
fi

# リージョン名の検証
if [[ ! "$REGION" =~ ^[a-z]{2}-[a-z]+-[0-9]$ ]]; then
    error "無効なAWSリージョン形式: $REGION"
    error "例: us-east-1, ap-northeast-1"
    exit 1
fi

# 次元数の検証
if [[ ! "$DIMENSIONS" =~ ^(256|384|1024|3072)$ ]]; then
    error "サポートされていない次元数: $DIMENSIONS"
    error "サポートされている次元数: 256, 384, 1024, 3072"
    exit 1
fi

# テストタイプの検証（セキュリティ強化）
ALLOWED_TEST_TYPES=("text" "image" "video" "audio" "document" "fsx" "batch" "spot-fleet" "ecs" "all")
if [[ ! " ${ALLOWED_TEST_TYPES[*]} " =~ " ${TEST_TYPE} " ]]; then
    error "サポートされていないテストタイプ: $TEST_TYPE"
    error "サポートされているテストタイプ: ${ALLOWED_TEST_TYPES[*]}"
    exit 1
fi

# テストタイプの正規化（大文字小文字の統一）
TEST_TYPE=$(echo "$TEST_TYPE" | tr '[:upper:]' '[:lower:]')

log "Nova Multimodal Embeddingsテスト開始"
log "Lambda関数名: $FUNCTION_NAME"
log "リージョン: $REGION"
log "テストタイプ: $TEST_TYPE"
log "埋め込み次元数: $DIMENSIONS"

# 前提条件の確認
check_prerequisites() {
    log "前提条件を確認中..."
    
    # AWS CLIの確認
    if ! command -v aws &> /dev/null; then
        error "AWS CLIがインストールされていません"
        error "インストール方法: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
        return 1
    fi
    
    # jqの確認
    if ! command -v jq &> /dev/null; then
        error "jqがインストールされていません"
        error "インストール方法: sudo apt-get install jq (Ubuntu) または brew install jq (macOS)"
        return 1
    fi
    
    # AWS認証の確認
    if ! aws sts get-caller-identity --region "$REGION" &> /dev/null; then
        error "AWS認証が設定されていません"
        error "aws configure を実行してください"
        return 1
    fi
    
    # Lambda関数の存在確認
    log "Lambda関数の存在確認中..."
    if ! aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" &> /dev/null; then
        error "Lambda関数が見つかりません: $FUNCTION_NAME"
        error "リージョン: $REGION"
        
        # 利用可能な関数の一覧表示（デバッグ支援）
        log "利用可能なLambda関数一覧:"
        aws lambda list-functions --region "$REGION" --query 'Functions[].FunctionName' --output table 2>/dev/null || true
        return 1
    fi
    
    log "前提条件の確認が完了しました"
    return 0
}

# 前提条件チェックの実行
if ! check_prerequisites; then
    exit 1
fi

# Lambda関数呼び出し
invoke_lambda_function() {
    local payload="$1"
    local response_file="/tmp/nova-test-response.json"
    
    aws lambda invoke \
        --function-name "$FUNCTION_NAME" \
        --region "$REGION" \
        --payload "$payload" \
        --cli-binary-format raw-in-base64-out \
        "$response_file" 2>&1
}

# レスポンス解析
parse_lambda_response() {
    local response_file="/tmp/nova-test-response.json"
    
    if [[ ! -f "$response_file" ]]; then
        echo "レスポンスファイルが見つかりません"
        return 1
    fi
    
    local response_body
    response_body=$(cat "$response_file")
    
    if [[ "$VERBOSE" == "true" ]]; then
        log "レスポンス: $response_body"
    fi
    
    # 成功判定
    if echo "$response_body" | jq -e '.success == true' &> /dev/null; then
        return 0
    else
        local error_msg
        error_msg=$(echo "$response_body" | jq -r '.error // "不明なエラー"')
        echo "$error_msg"
        return 1
    fi
}

# テスト実行関数（リファクタリング版）
run_test() {
    local test_name="$1"
    local payload="$2"
    
    log "テスト実行中: $test_name"
    
    if [[ "$VERBOSE" == "true" ]]; then
        log "ペイロード: $payload"
    fi
    
    # Lambda関数呼び出し
    local invoke_result
    if invoke_result=$(invoke_lambda_function "$payload"); then
        # レスポンス解析
        local parse_result
        if parse_result=$(parse_lambda_response); then
            log "✅ $test_name: 成功"
            return 0
        else
            error "❌ $test_name: 失敗 - $parse_result"
            return 1
        fi
    else
        error "❌ $test_name: Lambda呼び出し失敗 - $invoke_result"
        return 1
    fi
}

# FSxファイルからのNova Multimodal埋め込みジョブ投入テスト
test_fsx_multimodal_job() {
    local payload
    payload=$(cat << EOF
{
    "action": "submit_nova_multimodal_job",
    "fsxFilePath": "/mnt/fsx-data/test/sample.txt",
    "options": {
        "dimensions": $DIMENSIONS,
        "userId": "test-user",
        "contentType": "text"
    }
}
EOF
)
    
    run_test "FSx Nova Multimodal ジョブ投入" "$payload"
}

# Spot Fleet マルチモーダル処理テスト
test_spot_fleet_multimodal() {
    local payload
    payload=$(cat << EOF
{
    "action": "test_spot_fleet_multimodal",
    "options": {
        "dimensions": $DIMENSIONS,
        "testFiles": [
            "/mnt/fsx-data/test/sample-image.jpg",
            "/mnt/fsx-data/test/sample-video.mp4"
        ],
        "userId": "test-user"
    }
}
EOF
)
    
    run_test "Spot Fleet マルチモーダル処理" "$payload"
}

# ECS マルチモーダル処理テスト
test_ecs_multimodal() {
    local payload
    payload=$(cat << EOF
{
    "action": "test_ecs_multimodal",
    "options": {
        "dimensions": $DIMENSIONS,
        "testFiles": [
            "/mnt/fsx-data/test/sample-audio.mp3",
            "/mnt/fsx-data/test/sample-document.pdf"
        ],
        "userId": "test-user"
    }
}
EOF
)
    
    run_test "ECS マルチモーダル処理" "$payload"
}

# バッチ処理テスト
test_multimodal_batch() {
    local payload
    payload=$(cat << EOF
{
    "action": "process_multimodal_batch",
    "fsxFiles": [
        {
            "path": "/mnt/fsx-data/test/sample1.txt",
            "userId": "test-user",
            "contentType": "text"
        },
        {
            "path": "/mnt/fsx-data/test/sample2.jpg",
            "userId": "test-user",
            "contentType": "image"
        }
    ],
    "options": {
        "dimensions": $DIMENSIONS
    }
}
EOF
)
    
    run_test "FSx マルチモーダルバッチ処理" "$payload"
}

# Nova Multimodal Embeddingsの基本テスト
test_nova_multimodal_basic() {
    local payload
    payload=$(cat << EOF
{
    "action": "test_nova_multimodal"
}
EOF
)
    
    run_test "Nova Multimodal基本テスト" "$payload"
}

# テキスト埋め込みテスト
test_text_embedding() {
    local payload
    payload=$(cat << EOF
{
    "action": "generate_nova_multimodal_embeddings",
    "content": "これはテスト用のサンプルテキストです。Amazon Nova Multimodal Embeddingsの機能をテストしています。",
    "contentType": "text",
    "options": {
        "dimensions": $DIMENSIONS,
        "normalize": true
    }
}
EOF
)
    
    run_test "テキスト埋め込み生成" "$payload"
}

# 画像埋め込みテスト
test_image_embedding() {
    local payload
    payload=$(cat << EOF
{
    "action": "generate_embeddings_from_s3",
    "bucketName": "test-images-bucket",
    "objectKey": "sample-image.jpg",
    "options": {
        "dimensions": $DIMENSIONS,
        "contentType": "image"
    }
}
EOF
)
    
    run_test "画像埋め込み生成" "$payload"
}

# 動画埋め込みテスト
test_video_embedding() {
    local payload
    payload=$(cat << EOF
{
    "action": "generate_embeddings_from_s3",
    "bucketName": "test-videos-bucket",
    "objectKey": "sample-video.mp4",
    "options": {
        "dimensions": $DIMENSIONS,
        "contentType": "video",
        "segmentation": true,
        "segmentLength": 30
    }
}
EOF
)
    
    run_test "動画埋め込み生成（セグメンテーション付き）" "$payload"
}

# 音声埋め込みテスト
test_audio_embedding() {
    local payload
    payload=$(cat << EOF
{
    "action": "generate_embeddings_from_s3",
    "bucketName": "test-audio-bucket",
    "objectKey": "sample-audio.mp3",
    "options": {
        "dimensions": $DIMENSIONS,
        "contentType": "audio",
        "segmentation": true,
        "segmentLength": 30
    }
}
EOF
)
    
    run_test "音声埋め込み生成（セグメンテーション付き）" "$payload"
}

# 文書埋め込みテスト
test_document_embedding() {
    local payload
    payload=$(cat << EOF
{
    "action": "generate_embeddings_from_s3",
    "bucketName": "test-documents-bucket",
    "objectKey": "sample-document.pdf",
    "options": {
        "dimensions": $DIMENSIONS,
        "contentType": "document",
        "segmentation": true
    }
}
EOF
)
    
    run_test "文書埋め込み生成（セグメンテーション付き）" "$payload"
}

# 設定取得テスト
test_get_config() {
    local payload
    payload=$(cat << EOF
{
    "action": "get_nova_multimodal_config"
}
EOF
)
    
    run_test "Nova Multimodal設定取得" "$payload"
}

# ヘルスチェックテスト
test_health_check() {
    local payload
    payload=$(cat << EOF
{
    "action": "health_check"
}
EOF
)
    
    run_test "ヘルスチェック" "$payload"
}

# テスト結果の集計
collect_test_results() {
    local test_results=()
    local success_count=0
    local total_count=0
    
    # 基本テストの実行
    log "基本テストの実行..."
    
    local tests=(
        "test_health_check:ヘルスチェック"
        "test_get_config:設定取得"
        "test_nova_multimodal_basic:基本機能"
    )
    
    # テストタイプに応じた追加テスト（最適化版）
    case "$TEST_TYPE" in
        text|all)
            tests+=("test_text_embedding:テキスト埋め込み")
            ;;
        image|all)
            tests+=("test_image_embedding:画像埋め込み")
            ;;
        video|all)
            tests+=("test_video_embedding:動画埋め込み")
            ;;
        audio|all)
            tests+=("test_audio_embedding:音声埋め込み")
            ;;
        document|all)
            tests+=("test_document_embedding:文書埋め込み")
            ;;
        fsx|all)
            tests+=("test_fsx_multimodal_job:FSx Nova Multimodal ジョブ投入")
            ;;
        batch|all)
            tests+=("test_multimodal_batch:FSx マルチモーダルバッチ処理")
            ;;
        spot-fleet|all)
            tests+=("test_spot_fleet_multimodal:Spot Fleet マルチモーダル処理")
            ;;
        ecs|all)
            tests+=("test_ecs_multimodal:ECS マルチモーダル処理")
            ;;
    esac
    
    # テスト実行
    for test_entry in "${tests[@]}"; do
        local test_func="${test_entry%%:*}"
        local test_name="${test_entry##*:}"
        
        # 関数名の安全性検証（セキュリティ強化）
        if [[ ! "$test_func" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
            log_error "無効な関数名が検出されました: $test_func"
            ((total_count++))
            test_results+=("❌ $test_name: 無効な関数名")
            continue
        fi
        
        # 関数の存在確認
        if ! declare -f "$test_func" >/dev/null 2>&1; then
            log_error "テスト関数が見つかりません: $test_func"
            ((total_count++))
            test_results+=("❌ $test_name: 関数未定義")
            continue
        fi
        
        ((total_count++))
        if $test_func; then
            ((success_count++))
            test_results+=("✅ $test_name: 成功")
        else
            test_results+=("❌ $test_name: 失敗")
        fi
    done
    
    # 結果の表示
    log "テスト結果サマリー:"
    for result in "${test_results[@]}"; do
        log "$result"
    done
    
    log "成功: $success_count/$total_count"
    
    # 成功率の計算（ゼロ除算対策）
    local success_rate=0
    if [[ $total_count -gt 0 ]]; then
        success_rate=$((success_count * 100 / total_count))
    fi
    log "成功率: ${success_rate}% ($success_count/$total_count)"
    
    if [[ $success_count -eq $total_count ]]; then
        log "🎉 すべてのテストが成功しました"
        return 0
    else
        error "❌ 一部のテストが失敗しました"
        return 1
    fi
}

# メインテスト実行
main() {
    local start_time=$(date +%s)
    
    log "Nova Multimodal Embeddingsテスト開始"
    
    if collect_test_results; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log "テスト完了 (実行時間: ${duration}秒)"
        exit 0
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        error "テスト失敗 (実行時間: ${duration}秒)"
        exit 1
    fi
}

# クリーンアップ（セキュリティ強化）
cleanup() {
    local exit_code=$?
    
    log_info "クリーンアップを実行中..."
    
    # 一時ファイルのセキュアな削除
    local temp_files=(
        "/tmp/nova-test-response.json"
        "/tmp/spot-fleet-test-response.json"
        "/tmp/ecs-test-response.json"
    )
    
    for temp_file in "${temp_files[@]}"; do
        if [[ -f "$temp_file" ]]; then
            if command -v shred >/dev/null 2>&1; then
                shred -vfz -n 3 "$temp_file" 2>/dev/null || rm -f "$temp_file"
            else
                rm -f "$temp_file"
            fi
        fi
    done
    
    # 機密変数のクリア
    unset FUNCTION_NAME REGION DIMENSIONS TEST_TYPE VERBOSE
    unset ALLOWED_TEST_TYPES
    
    if [[ $exit_code -ne 0 ]]; then
        error "スクリプトがエラーで終了しました (終了コード: $exit_code)"
        log_info "ログファイル: $LOG_FILE"
    else
        log_info "テスト完了 - ログファイル: $LOG_FILE"
    fi
    
    exit $exit_code
}

# シグナルハンドラの設定
trap cleanup EXIT

# メイン処理の実行
main