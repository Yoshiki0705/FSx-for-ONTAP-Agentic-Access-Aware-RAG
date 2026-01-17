#!/bin/bash

# End-to-End Test Runner Script
# Embedding Batch Workloadの包括的なエンドツーエンドテストを実行

set -euo pipefail

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CDK_DIR="$PROJECT_ROOT/cdk"
TEST_DIR="$CDK_DIR/test"
E2E_DIR="$TEST_DIR/e2e"

# ログ設定
LOG_DIR="$TEST_DIR/logs"
LOG_FILE="$LOG_DIR/e2e-test-$(date +%Y%m%d-%H%M%S).log"

# 色付きログ関数
log_info() {
    echo -e "\\033[32m[INFO]\\033[0m $1" | tee -a "$LOG_FILE"
}

log_warn() {
    echo -e "\\033[33m[WARN]\\033[0m $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "\\033[31m[ERROR]\\033[0m $1" | tee -a "$LOG_FILE"
}

# 使用方法を表示
show_usage() {
    cat << EOF
使用方法: $0 [オプション] [環境名]

オプション:
  -h, --help              このヘルプを表示
  -c, --config FILE       テスト設定ファイルを指定 (デフォルト: test-config.json)
  -e, --environment ENV   テスト環境を指定 (minimal|production)
  -v, --verbose           詳細ログを有効化
  --dry-run              実際のデプロイメントを行わずにテストプランを表示
  --cleanup-only         クリーンアップのみ実行
  --skip-cleanup         テスト後のクリーンアップをスキップ

環境:
  minimal     最小構成でのテスト (デフォルト)
  production  本番相当の構成でのテスト

例:
  $0                          # 最小構成でテスト実行
  $0 production               # 本番構成でテスト実行
  $0 -v minimal               # 詳細ログ付きで最小構成テスト
  $0 --dry-run production     # 本番構成のテストプランを表示
  $0 --cleanup-only           # クリーンアップのみ実行

EOF
}

# デフォルト値
ENVIRONMENT="minimal"
CONFIG_FILE=""
VERBOSE=false
DRY_RUN=false
CLEANUP_ONLY=false
SKIP_CLEANUP=false

# コマンドライン引数の解析
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -c|--config)
            CONFIG_FILE="$2"
            shift 2
            ;;
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --cleanup-only)
            CLEANUP_ONLY=true
            shift
            ;;
        --skip-cleanup)
            SKIP_CLEANUP=true
            shift
            ;;
        minimal|production)
            ENVIRONMENT="$1"
            shift
            ;;
        *)
            log_error "不明なオプション: $1"
            show_usage
            exit 1
            ;;
    esac
done

# ログディレクトリの作成
mkdir -p "$LOG_DIR"

log_info "=== Embedding Batch Workload E2E テスト開始 ==="
log_info "環境: $ENVIRONMENT"
log_info "ログファイル: $LOG_FILE"

# 前提条件チェック
check_prerequisites() {
    log_info "前提条件をチェック中..."
    
    # Node.js チェック
    if ! command -v node &> /dev/null; then
        log_error "Node.js がインストールされていません"
        exit 1
    fi
    
    # npm チェック
    if ! command -v npm &> /dev/null; then
        log_error "npm がインストールされていません"
        exit 1
    fi
    
    # AWS CLI チェック
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI がインストールされていません"
        exit 1
    fi
    
    # CDK チェック
    if ! command -v cdk &> /dev/null; then
        log_error "AWS CDK がインストールされていません"
        log_info "インストール: npm install -g aws-cdk"
        exit 1
    fi
    
    # AWS認証情報チェック
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS認証情報が設定されていません"
        exit 1
    fi
    
    # TypeScript チェック
    if ! command -v tsc &> /dev/null; then
        log_error "TypeScript がインストールされていません"
        log_info "インストール: npm install -g typescript"
        exit 1
    fi
    
    log_info "前提条件チェック完了"
}

# 依存関係のインストール
install_dependencies() {
    log_info "依存関係をインストール中..."
    
    cd "$CDK_DIR"
    
    if [[ ! -f "package.json" ]]; then
        log_error "package.json が見つかりません: $CDK_DIR"
        exit 1
    fi
    
    # npm install
    if $VERBOSE; then
        npm install
    else
        npm install > /dev/null 2>&1
    fi
    
    # TypeScript コンパイル
    if $VERBOSE; then
        npm run build
    else
        npm run build > /dev/null 2>&1
    fi
    
    log_info "依存関係のインストール完了"
}

# テスト設定の検証
validate_test_config() {
    log_info "テスト設定を検証中..."
    
    local config_path
    if [[ -n "$CONFIG_FILE" ]]; then
        config_path="$CONFIG_FILE"
    else
        config_path="$E2E_DIR/test-config.json"
    fi
    
    if [[ ! -f "$config_path" ]]; then
        log_error "テスト設定ファイルが見つかりません: $config_path"
        exit 1
    fi
    
    # JSON形式の検証
    if ! jq empty "$config_path" 2>/dev/null; then
        log_error "テスト設定ファイルのJSON形式が不正です: $config_path"
        exit 1
    fi
    
    # 必要な環境設定の確認
    if ! jq -e ".testEnvironments.\\\"$ENVIRONMENT\\\"" "$config_path" > /dev/null; then
        log_error "環境 '$ENVIRONMENT' の設定が見つかりません"
        exit 1
    fi
    
    log_info "テスト設定の検証完了"
}

# 既存リソースのクリーンアップ
cleanup_existing_resources() {
    log_info "既存のテストリソースをクリーンアップ中..."
    
    # CloudFormationスタックの削除
    local stacks
    stacks=$(aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --query 'StackSummaries[?contains(StackName, `e2e-`) == `true`].StackName' --output text)
    
    if [[ -n "$stacks" ]]; then
        for stack in $stacks; do
            log_info "スタックを削除中: $stack"
            aws cloudformation delete-stack --stack-name "$stack"
        done
        
        # 削除完了を待機
        for stack in $stacks; do
            log_info "スタック削除完了を待機中: $stack"
            aws cloudformation wait stack-delete-complete --stack-name "$stack" || true
        done
    fi
    
    # S3バケットのクリーンアップ
    local buckets
    buckets=$(aws s3api list-buckets --query 'Buckets[?contains(Name, `e2e-`) == `true`].Name' --output text)
    
    if [[ -n "$buckets" ]]; then
        for bucket in $buckets; do
            log_info "S3バケットを削除中: $bucket"
            aws s3 rm "s3://$bucket" --recursive || true
            aws s3api delete-bucket --bucket "$bucket" || true
        done
    fi
    
    log_info "既存リソースのクリーンアップ完了"
}

# ドライランモード
run_dry_run() {
    log_info "=== ドライランモード ==="
    
    local config_path
    if [[ -n "$CONFIG_FILE" ]]; then
        config_path="$CONFIG_FILE"
    else
        config_path="$E2E_DIR/test-config.json"
    fi
    
    log_info "テスト設定ファイル: $config_path"
    log_info "テスト環境: $ENVIRONMENT"
    
    # テスト環境の詳細を表示
    local env_config
    env_config=$(jq -r ".testEnvironments.\\\"$ENVIRONMENT\\\"" "$config_path")
    
    echo "環境設定:"
    echo "$env_config" | jq .
    
    # テストケースを表示
    local test_cases
    test_cases=$(echo "$env_config" | jq -r '.testCases[]')
    
    log_info "実行予定のテストケース:"
    while IFS= read -r test_case; do
        log_info "  - $test_case"
    done <<< "$test_cases"
    
    log_info "=== ドライラン完了 ==="
}

# E2Eテストの実行
run_e2e_tests() {
    log_info "E2Eテストを実行中..."
    
    cd "$CDK_DIR"
    
    # テストランナーの実行
    local test_command="node test/e2e/e2e-test-runner.js"
    
    if [[ -n "$CONFIG_FILE" ]]; then
        test_command="$test_command --config $CONFIG_FILE"
    fi
    
    test_command="$test_command $ENVIRONMENT"
    
    log_info "実行コマンド: $test_command"
    
    # テスト実行
    local exit_code=0
    if $VERBOSE; then
        $test_command || exit_code=$?
    else
        $test_command >> "$LOG_FILE" 2>&1 || exit_code=$?
    fi
    
    if [[ $exit_code -eq 0 ]]; then
        log_info "E2Eテスト成功"
    else
        log_error "E2Eテスト失敗 (終了コード: $exit_code)"
        return $exit_code
    fi
}

# テスト結果の集計
collect_test_results() {
    log_info "テスト結果を集計中..."
    
    local results_dir="$TEST_DIR/results"
    mkdir -p "$results_dir"
    
    # ログファイルから結果を抽出
    local summary_file="$results_dir/e2e-summary-$(date +%Y%m%d-%H%M%S).json"
    
    # 簡単な結果サマリーを作成
    cat > "$summary_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "$ENVIRONMENT",
  "logFile": "$LOG_FILE",
  "status": "completed"
}
EOF
    
    log_info "テスト結果サマリー: $summary_file"
    
    # レポートファイルがあれば表示
    local report_files
    report_files=$(find "$LOG_DIR" -name "e2e-report-*.md" -type f 2>/dev/null | head -1)
    
    if [[ -n "$report_files" ]]; then
        log_info "詳細レポート: $report_files"
        
        if $VERBOSE; then
            echo ""
            echo "=== テスト結果レポート ==="
            cat "$report_files"
            echo "=========================="
        fi
    fi
}

# メイン実行フロー
main() {
    # クリーンアップのみの場合
    if $CLEANUP_ONLY; then
        cleanup_existing_resources
        log_info "クリーンアップ完了"
        exit 0
    fi
    
    # ドライランの場合
    if $DRY_RUN; then
        check_prerequisites
        validate_test_config
        run_dry_run
        exit 0
    fi
    
    # 通常のテスト実行
    local exit_code=0
    
    # 前処理
    check_prerequisites
    install_dependencies
    validate_test_config
    
    # 既存リソースのクリーンアップ
    if ! $SKIP_CLEANUP; then
        cleanup_existing_resources
    fi
    
    # テスト実行
    run_e2e_tests || exit_code=$?
    
    # 後処理
    collect_test_results
    
    # 最終クリーンアップ
    if ! $SKIP_CLEANUP && [[ $exit_code -eq 0 ]]; then
        log_info "最終クリーンアップを実行中..."
        cleanup_existing_resources
    fi
    
    if [[ $exit_code -eq 0 ]]; then
        log_info "=== E2Eテスト完了 (成功) ==="
    else
        log_error "=== E2Eテスト完了 (失敗) ==="
    fi
    
    exit $exit_code
}

# エラーハンドリング
trap 'log_error "スクリプトが予期せず終了しました"; exit 1' ERR

# メイン実行
main "$@"