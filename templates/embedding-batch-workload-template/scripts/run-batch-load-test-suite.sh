#!/bin/bash

# AWS Batch 負荷試験統合実行スクリプト
# 負荷試験の実行からレポート生成まで一括実行

set -euo pipefail

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ライブラリの読み込み
source "$SCRIPT_DIR/lib/batch-metrics-collector.sh"

# デフォルト値
TEST_SUITE="comprehensive"
STACK_NAME=""
SKIP_LOAD_TEST=false
SKIP_DASHBOARD=false
CLEANUP_AFTER_TEST=true
NOTIFICATION_EMAIL=""

# 色付きログ関数
log_info() {
    echo -e "\\033[32m[INFO]\\033[0m $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_warn() {
    echo -e "\\033[33m[WARN]\\033[0m $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_error() {
    echo -e "\\033[31m[ERROR]\\033[0m $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_success() {
    echo -e "\\033[32m[SUCCESS]\\033[0m $(date '+%Y-%m-%d %H:%M:%S') $1"
}

# 使用方法を表示
show_usage() {
    cat << EOF
使用方法: $0 [オプション]

AWS Batch負荷試験統合実行スクリプト

オプション:
  -h, --help                  このヘルプを表示
  -t, --test-suite SUITE      テストスイート (basic|standard|comprehensive|stress)
  -s, --stack-name NAME       CloudFormationスタック名
  --skip-load-test           負荷試験をスキップ（既存結果を使用）
  --skip-dashboard           ダッシュボード生成をスキップ
  --no-cleanup               テスト後のクリーンアップをスキップ
  --notification-email EMAIL 完了通知メールアドレス

テストスイート:
  basic         基本テスト (100ファイル, 5並列, 30分)
  standard      標準テスト (500ファイル, 10並列, 60分)
  comprehensive 包括テスト (1000ファイル, 15並列, 90分)
  stress        ストレステスト (2000ファイル, 20並列, 120分)

例:
  $0 --test-suite standard --stack-name my-embedding-stack
  $0 --test-suite comprehensive --notification-email admin@company.com
  $0 --skip-load-test --stack-name existing-stack

EOF
}

# コマンドライン引数の解析
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -t|--test-suite)
            TEST_SUITE="$2"
            shift 2
            ;;
        -s|--stack-name)
            STACK_NAME="$2"
            shift 2
            ;;
        --skip-load-test)
            SKIP_LOAD_TEST=true
            shift
            ;;
        --skip-dashboard)
            SKIP_DASHBOARD=true
            shift
            ;;
        --no-cleanup)
            CLEANUP_AFTER_TEST=false
            shift
            ;;
        --notification-email)
            NOTIFICATION_EMAIL="$2"
            shift 2
            ;;
        *)
            log_error "不明なオプション: $1"
            show_usage
            exit 1
            ;;
    esac
done

log_info "=== AWS Batch 負荷試験統合実行開始 ==="
log_info "テストスイート: $TEST_SUITE"
log_info "スタック名: ${STACK_NAME:-自動検出}"
log_info "負荷試験スキップ: $SKIP_LOAD_TEST"
log_info "ダッシュボードスキップ: $SKIP_DASHBOARD"
log_info "テスト後クリーンアップ: $CLEANUP_AFTER_TEST"
log_info "通知メール: ${NOTIFICATION_EMAIL:-なし}"

# テストスイート設定の取得
get_test_suite_config() {
    local suite="$1"
    
    case "$suite" in
        "basic")
            echo '{"file_count": 100, "batch_size": 20, "concurrent_jobs": 5, "duration": 1800, "description": "基本テスト"}'
            ;;
        "standard")
            echo '{"file_count": 500, "batch_size": 25, "concurrent_jobs": 10, "duration": 3600, "description": "標準テスト"}'
            ;;
        "comprehensive")
            echo '{"file_count": 1000, "batch_size": 50, "concurrent_jobs": 15, "duration": 5400, "description": "包括テスト"}'
            ;;
        "stress")
            echo '{"file_count": 2000, "batch_size": 100, "concurrent_jobs": 20, "duration": 7200, "description": "ストレステスト"}'
            ;;
        *)
            log_error "不明なテストスイート: $suite"
            exit 1
            ;;
    esac
}

# 前提条件チェック
check_prerequisites() {
    log_info "前提条件をチェック中..."
    
    # 必要なスクリプトの存在確認
    local required_scripts=(
        "$SCRIPT_DIR/load-test-aws-batch.sh"
        "$SCRIPT_DIR/generate-batch-dashboard.sh"
    )
    
    for script in "${required_scripts[@]}"; do
        if [[ ! -f "$script" ]]; then
            log_error "必要なスクリプトが見つかりません: $script"
            exit 1
        fi
        
        if [[ ! -x "$script" ]]; then
            log_warn "スクリプトに実行権限がありません。権限を設定中: $script"
            chmod +x "$script"
        fi
    done
    
    # AWS CLI とその他のツール確認
    local required_commands=("aws" "jq" "bc")
    local missing_commands=()
    
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_commands+=("$cmd")
        fi
    done
    
    if [[ ${#missing_commands[@]} -gt 0 ]]; then
        log_error "以下のコマンドが必要です: ${missing_commands[*]}"
        exit 1
    fi
    
    # AWS認証情報チェック
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS認証情報が設定されていません"
        exit 1
    fi
    
    log_info "前提条件チェック完了"
}

# 負荷試験の実行
run_load_test() {
    if $SKIP_LOAD_TEST; then
        log_info "負荷試験をスキップ（既存結果を使用）"
        return
    fi
    
    log_info "負荷試験を実行中..."
    
    local config
    config=$(get_test_suite_config "$TEST_SUITE")
    
    local file_count
    file_count=$(echo "$config" | jq -r '.file_count')
    
    local batch_size
    batch_size=$(echo "$config" | jq -r '.batch_size')
    
    local concurrent_jobs
    concurrent_jobs=$(echo "$config" | jq -r '.concurrent_jobs')
    
    local duration
    duration=$(echo "$config" | jq -r '.duration')
    
    local description
    description=$(echo "$config" | jq -r '.description')
    
    log_info "実行設定: $description"
    log_info "  ファイル数: $file_count"
    log_info "  バッチサイズ: $batch_size"
    log_info "  並列ジョブ数: $concurrent_jobs"
    log_info "  実行時間: $duration 秒"
    
    # 負荷試験スクリプトの実行
    local load_test_args=(
        "--file-count" "$file_count"
        "--batch-size" "$batch_size"
        "--concurrent-jobs" "$concurrent_jobs"
        "--duration" "$duration"
        "--verbose"
    )
    
    if [[ -n "$STACK_NAME" ]]; then
        load_test_args+=("--stack-name" "$STACK_NAME")
    fi
    
    if ! "$SCRIPT_DIR/load-test-aws-batch.sh" "${load_test_args[@]}"; then
        log_error "負荷試験が失敗しました"
        exit 1
    fi
    
    log_success "負荷試験完了"
}

# メトリクス収集の実行
collect_comprehensive_metrics() {
    log_info "包括的メトリクス収集を実行中..."
    
    # 最新のログディレクトリを検索
    local log_dirs
    log_dirs=$(find "$PROJECT_ROOT" -name "*batch-load-test*" -type d | sort | tail -1)
    
    if [[ -z "$log_dirs" ]]; then
        log_warn "負荷試験のログディレクトリが見つかりません"
        return
    fi
    
    local metrics_dir="$log_dirs/comprehensive-metrics"
    mkdir -p "$metrics_dir"
    
    # テスト設定の保存
    local config
    config=$(get_test_suite_config "$TEST_SUITE")
    echo "$config" > "$metrics_dir/test-config.json"
    
    log_info "包括的メトリクス収集完了: $metrics_dir"
    METRICS_DIR="$metrics_dir"
}

# ダッシュボード生成の実行
generate_dashboard() {
    if $SKIP_DASHBOARD; then
        log_info "ダッシュボード生成をスキップ"
        return
    fi
    
    log_info "ダッシュボードを生成中..."
    
    local dashboard_args=(
        "--dashboard-name" "EmbeddingBatch-$TEST_SUITE-$(date +%Y%m%d)"
    )
    
    if [[ -n "${METRICS_DIR:-}" ]]; then
        dashboard_args+=("--metrics-dir" "$METRICS_DIR")
    fi
    
    if ! "$SCRIPT_DIR/generate-batch-dashboard.sh" "${dashboard_args[@]}"; then
        log_error "ダッシュボード生成が失敗しました"
        return 1
    fi
    
    log_success "ダッシュボード生成完了"
}

# 結果分析とレポート生成
analyze_results() {
    log_info "結果分析を実行中..."
    
    local analysis_file="$PROJECT_ROOT/reports/batch-analysis-$(date +%Y%m%d-%H%M%S).json"
    mkdir -p "$(dirname "$analysis_file")"
    
    # 基本分析の実行
    local analysis_result="{}"
    
    # テスト設定の追加
    local config
    config=$(get_test_suite_config "$TEST_SUITE")
    analysis_result=$(echo "$analysis_result" | jq --argjson config "$config" '. + {test_configuration: $config}')
    
    # 実行時間の記録
    analysis_result=$(echo "$analysis_result" | jq --arg start_time "${TEST_START_TIME:-}" --arg end_time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '
        . + {
            execution_timeline: {
                start_time: $start_time,
                end_time: $end_time,
                total_duration: (if $start_time != "" then ((now | strftime("%s")) - ($start_time | fromdateiso8601)) else null end)
            }
        }
    ')
    
    # 推奨事項の生成
    local recommendations
    recommendations=$(cat << 'EOF'
{
    "performance_optimization": [
        "バッチサイズの最適化を検討してください",
        "並列度の調整により効率を向上できます",
        "Spot インスタンスの活用でコストを削減できます"
    ],
    "monitoring_improvements": [
        "CloudWatch アラームの設定を推奨します",
        "カスタムメトリクスの追加を検討してください",
        "ログ分析の自動化を実装してください"
    ],
    "scalability_enhancements": [
        "自動スケーリング設定の最適化",
        "複数リージョンでの負荷分散",
        "キューイング戦略の改善"
    ]
}
EOF
    )
    
    analysis_result=$(echo "$analysis_result" | jq --argjson rec "$recommendations" '. + {recommendations: $rec}')
    
    # 分析結果の保存
    echo "$analysis_result" > "$analysis_file"
    
    log_info "結果分析完了: $analysis_file"
    ANALYSIS_FILE="$analysis_file"
}

# 通知の送信
send_notification() {
    if [[ -z "$NOTIFICATION_EMAIL" ]]; then
        return
    fi
    
    log_info "完了通知を送信中: $NOTIFICATION_EMAIL"
    
    local subject="AWS Batch 負荷試験完了 - $TEST_SUITE"
    local body
    body=$(cat << EOF
AWS Batch 負荷試験が完了しました。

テストスイート: $TEST_SUITE
実行日時: $(date)
スタック名: ${STACK_NAME:-自動検出}

結果:
- 負荷試験: $(if $SKIP_LOAD_TEST; then echo "スキップ"; else echo "完了"; fi)
- ダッシュボード: $(if $SKIP_DASHBOARD; then echo "スキップ"; else echo "生成完了"; fi)
- 分析レポート: ${ANALYSIS_FILE:-N/A}

詳細は CloudWatch ダッシュボードで確認してください。

自動生成メッセージ
EOF
    )
    
    # SNS または SES を使用して通知送信
    if aws sns list-topics &> /dev/null; then
        # SNS トピックが利用可能な場合
        local topic_arn
        topic_arn=$(aws sns list-topics --query 'Topics[?contains(TopicArn, `batch-notifications`)].TopicArn' --output text | head -1)
        
        if [[ -n "$topic_arn" ]]; then
            aws sns publish --topic-arn "$topic_arn" --subject "$subject" --message "$body"
            log_info "SNS 通知送信完了"
        else
            log_warn "SNS トピックが見つかりません"
        fi
    else
        log_warn "通知送信をスキップ（SNS が利用できません）"
    fi
}

# クリーンアップの実行
cleanup_test_resources() {
    if ! $CLEANUP_AFTER_TEST; then
        log_info "クリーンアップをスキップ"
        return
    fi
    
    log_info "テストリソースをクリーンアップ中..."
    
    # 一時ファイルの削除
    find "$PROJECT_ROOT" -name "test-doc-*.txt" -type f -mtime -1 -delete 2>/dev/null || true
    find "$PROJECT_ROOT" -name "batch-results-*.csv" -type f -mtime -1 -delete 2>/dev/null || true
    
    # S3 テストデータの削除確認
    read -p "S3上のテストデータを削除しますか？ (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "S3テストデータの削除は各負荷試験スクリプトで実行されます"
    fi
    
    log_info "クリーンアップ完了"
}

# 実行サマリーの表示
show_execution_summary() {
    log_info "=== 実行サマリー ==="
    
    local config
    config=$(get_test_suite_config "$TEST_SUITE")
    
    local description
    description=$(echo "$config" | jq -r '.description')
    
    echo ""
    echo "🚀 AWS Batch 負荷試験統合実行完了"
    echo ""
    echo "📊 テスト概要:"
    echo "  - テストスイート: $TEST_SUITE ($description)"
    echo "  - 実行日時: $(date)"
    echo "  - スタック名: ${STACK_NAME:-自動検出}"
    echo ""
    echo "✅ 実行項目:"
    echo "  - 負荷試験: $(if $SKIP_LOAD_TEST; then echo "スキップ"; else echo "完了"; fi)"
    echo "  - メトリクス収集: 完了"
    echo "  - ダッシュボード生成: $(if $SKIP_DASHBOARD; then echo "スキップ"; else echo "完了"; fi)"
    echo "  - 結果分析: 完了"
    echo "  - 通知送信: $(if [[ -n "$NOTIFICATION_EMAIL" ]]; then echo "完了"; else echo "なし"; fi)"
    echo "  - クリーンアップ: $(if $CLEANUP_AFTER_TEST; then echo "完了"; else echo "スキップ"; fi)"
    echo ""
    
    if [[ -n "${ANALYSIS_FILE:-}" ]]; then
        echo "📄 生成されたファイル:"
        echo "  - 分析レポート: $ANALYSIS_FILE"
        
        if [[ -d "$PROJECT_ROOT/reports/batch-dashboard" ]]; then
            echo "  - HTMLレポート: $PROJECT_ROOT/reports/batch-dashboard/batch-load-test-report.html"
        fi
    fi
    
    echo ""
    echo "🔗 関連リンク:"
    echo "  - CloudWatch ダッシュボード: AWS コンソールで確認"
    echo "  - Cost Explorer: コスト分析の詳細確認"
    echo ""
    
    log_success "AWS Batch 負荷試験統合実行が正常に完了しました"
}

# エラーハンドリング
handle_error() {
    local exit_code=$?
    log_error "スクリプトがエラーで終了しました (終了コード: $exit_code)"
    
    # エラー時の通知
    if [[ -n "$NOTIFICATION_EMAIL" ]]; then
        local subject="AWS Batch 負荷試験エラー - $TEST_SUITE"
        local body="AWS Batch 負荷試験中にエラーが発生しました。ログを確認してください。"
        
        # 簡単な通知送信試行
        echo "$body" | aws ses send-email --from "$NOTIFICATION_EMAIL" --to "$NOTIFICATION_EMAIL" --message "Subject={Data='$subject'},Body={Text={Data='$body'}}" 2>/dev/null || true
    fi
    
    exit $exit_code
}

# メイン実行関数
main() {
    # 開始時刻の記録
    TEST_START_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    
    # 前提条件チェック
    check_prerequisites
    
    # 負荷試験の実行
    run_load_test
    
    # メトリクス収集
    collect_comprehensive_metrics
    
    # ダッシュボード生成
    generate_dashboard
    
    # 結果分析
    analyze_results
    
    # 通知送信
    send_notification
    
    # クリーンアップ
    cleanup_test_resources
    
    # 実行サマリー表示
    show_execution_summary
}

# エラートラップ設定
trap handle_error ERR

# メイン実行
main "$@"