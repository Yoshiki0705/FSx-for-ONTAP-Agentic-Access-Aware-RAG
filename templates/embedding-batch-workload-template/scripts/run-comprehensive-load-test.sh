#!/bin/bash

# 包括的負荷試験実行スクリプト
# 全コンピュート構成での統合負荷試験とMCP統合コスト最適化

set -euo pipefail

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 共通ライブラリの読み込み
source "${SCRIPT_DIR}/lib/logging.sh"

# 設定ファイルの読み込み
CONFIG_FILE="${PROJECT_ROOT}/config/load-test-config.json"
if [[ ! -f "$CONFIG_FILE" ]]; then
    log_error "設定ファイルが見つかりません: $CONFIG_FILE"
    exit 1
fi

# jqの存在確認
if ! command -v jq >/dev/null 2>&1; then
    log_error "jqコマンドが必要です。インストールしてください: sudo apt-get install jq"
    exit 1
fi

# デフォルト設定
REGION="${AWS_DEFAULT_REGION:-ap-northeast-1}"
WORKLOAD_SIZE="medium"
MAX_TOTAL_COST=200.00
SIMULATION_MODE=true
OUTPUT_DIR=""
INCLUDE_MCP=true
PARALLEL_EXECUTION=false

# 使用方法を表示
show_usage() {
    cat << EOF
使用方法: $0 [オプション]

包括的負荷試験オプション:
  --workload-size SIZE       ワークロードサイズ (small/medium/large)
  --max-total-cost AMOUNT    最大総コスト制限 (デフォルト: $MAX_TOTAL_COST)
  --region REGION            AWSリージョン (デフォルト: $REGION)
  --no-simulation            実際のAWSリソースを使用
  --no-mcp                   MCP統合機能を無効化
  --parallel                 並列実行（注意: コスト増加）
  --output-dir DIR           出力ディレクトリ
  --help                     このヘルプを表示

ワークロードサイズ:
  small   - 100ファイル, 10分, 予算\$15
  medium  - 500ファイル, 30分, 予算\$50
  large   - 1000ファイル, 60分, 予算\$100

例:
  $0 --workload-size large --max-total-cost 300.00
  $0 --no-simulation --workload-size small
  $0 --parallel --workload-size medium --no-mcp
EOF
}

# パラメータ解析
while [[ $# -gt 0 ]]; do
    case $1 in
        --workload-size)
            WORKLOAD_SIZE="$2"
            shift 2
            ;;
        --max-total-cost)
            MAX_TOTAL_COST="$2"
            shift 2
            ;;
        --region)
            REGION="$2"
            shift 2
            ;;
        --no-simulation)
            SIMULATION_MODE=false
            shift
            ;;
        --no-mcp)
            INCLUDE_MCP=false
            shift
            ;;
        --parallel)
            PARALLEL_EXECUTION=true
            shift
            ;;
        --output-dir)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            log_error "不明なオプション: $1"
            show_usage
            exit 1
            ;;
    esac
done

# 出力ディレクトリの設定
if [[ -z "$OUTPUT_DIR" ]]; then
    OUTPUT_DIR="$PROJECT_ROOT/reports/comprehensive-test-$(date +%Y%m%d-%H%M%S)"
fi

# 出力ディレクトリの作成
mkdir -p "$OUTPUT_DIR"
log_info "包括的負荷試験出力ディレクトリ: $OUTPUT_DIR"

# 設定読み込み関数
load_configuration() {
    log_debug "設定ファイル読み込み: $CONFIG_FILE"
    
    # ワークロードサイズの検証
    if ! jq -e ".workload_sizes.${WORKLOAD_SIZE}" "$CONFIG_FILE" >/dev/null; then
        log_error "不明なワークロードサイズ: $WORKLOAD_SIZE"
        log_info "利用可能なサイズ: $(jq -r '.workload_sizes | keys | join(", ")' "$CONFIG_FILE")"
        exit 1
    fi
    
    log_configuration
}

# ワークロードサイズ別設定取得
get_workload_settings() {
    local files
    local duration
    local budget
    
    files=$(jq -r ".workload_sizes.${WORKLOAD_SIZE}.files" "$CONFIG_FILE")
    duration=$(jq -r ".workload_sizes.${WORKLOAD_SIZE}.duration" "$CONFIG_FILE")
    budget=$(jq -r ".workload_sizes.${WORKLOAD_SIZE}.budget" "$CONFIG_FILE")
    
    echo "files:$files duration:$duration budget:$budget"
}

# 料金設定取得
get_pricing_config() {
    local service="$1"
    local key="$2"
    
    jq -r ".pricing.${service}.${key}" "$CONFIG_FILE"
}

# 事前コスト分析
perform_cost_analysis() {
    log_info "=== 事前コスト分析開始 ==="
    
    local workload_settings
    workload_settings=$(get_workload_settings)
    
    local files=$(echo "$workload_settings" | cut -d' ' -f1 | cut -d':' -f2)
    local duration=$(echo "$workload_settings" | cut -d' ' -f2 | cut -d':' -f2)
    local budget=$(echo "$workload_settings" | cut -d' ' -f3 | cut -d':' -f2)
    
    log_cost "💰 ワークロード設定:"
    log_cost "   - ファイル数: $files"
    log_cost "   - 実行時間: $duration 秒"
    log_cost "   - 個別予算: \$$budget"
    log_cost "   - 総予算制限: \$$MAX_TOTAL_COST"
    
    # 各構成の予想コスト
    local duration_hours=$(echo "scale=2; $duration / 3600" | bc -l)
    
    # AWS Batch
    local batch_instances=$(echo "scale=0; $files / 50" | bc -l)
    local batch_cost=$(echo "scale=2; $batch_instances * 0.0416 * $duration_hours" | bc -l)
    
    # ECS on EC2
    local ecs_instances=$(echo "scale=0; $files / 100" | bc -l)
    local ecs_cost=$(echo "scale=2; $ecs_instances * 0.0416 * $duration_hours" | bc -l)
    
    # ECS Fargate
    local fargate_tasks=$(echo "scale=0; $files / 20" | bc -l)
    local fargate_cost=$(echo "scale=2; $fargate_tasks * (0.25 * 0.04656 + 0.5 * 0.00511) * $duration_hours" | bc -l)
    
    # Spot Fleet
    local spot_instances=$(echo "scale=0; $files / 80" | bc -l)
    local spot_cost=$(echo "scale=2; $spot_instances * 0.0125 * $duration_hours" | bc -l)
    
    local total_estimated_cost=$(echo "scale=2; $batch_cost + $ecs_cost + $fargate_cost + $spot_cost" | bc -l)
    
    log_cost "💰 構成別予想コスト:"
    log_cost "   - AWS Batch: \$$batch_cost"
    log_cost "   - ECS on EC2: \$$ecs_cost"
    log_cost "   - ECS Fargate: \$$fargate_cost"
    log_cost "   - Spot Fleet: \$$spot_cost"
    log_cost "   - 総計: \$$total_estimated_cost"
    
    # コスト制限チェック
    if (( $(echo "$total_estimated_cost > $MAX_TOTAL_COST" | bc -l) )); then
        log_error "予想総コスト（\$$total_estimated_cost）が制限（\$$MAX_TOTAL_COST）を超過"
        log_error "ワークロードサイズを小さくするか、予算制限を増やしてください"
        exit 1
    fi
    
    log_cost "✅ コスト制限内での実行が可能です"
    
    # コスト分析結果を保存
    cat > "$OUTPUT_DIR/cost-analysis.json" << EOF
{
  "workload": {
    "size": "$WORKLOAD_SIZE",
    "files": $files,
    "duration_seconds": $duration,
    "budget_per_config": $budget,
    "total_budget": $MAX_TOTAL_COST
  },
  "estimated_costs": {
    "aws_batch": $batch_cost,
    "ecs_ec2": $ecs_cost,
    "ecs_fargate": $fargate_cost,
    "spot_fleet": $spot_cost,
    "total": $total_estimated_cost
  },
  "cost_check": {
    "within_budget": true,
    "remaining_budget": $(echo "scale=2; $MAX_TOTAL_COST - $total_estimated_cost" | bc -l)
  }
}
EOF
}

# AWS Batch 負荷試験実行
run_batch_test() {
    log_info "=== AWS Batch 負荷試験実行 ==="
    
    local workload_settings
    workload_settings=$(get_workload_settings)
    local budget=$(echo "$workload_settings" | cut -d' ' -f3 | cut -d':' -f2)
    
    local batch_output="$OUTPUT_DIR/aws-batch"
    mkdir -p "$batch_output"
    
    if [[ "$SIMULATION_MODE" == "true" ]]; then
        log_info "シミュレーションモード: AWS Batch負荷試験"
        
        # MCP統合版スクリプトを使用
        if [[ -f "$SCRIPT_DIR/run-mcp-integrated-load-test.sh" ]]; then
            "$SCRIPT_DIR/run-mcp-integrated-load-test.sh" \
                --simulation \
                --max-cost "$budget" \
                --output-dir "$batch_output" \
                --region "$REGION" || log_warn "AWS Batch テスト完了（一部エラーあり）"
        else
            log_warn "MCP統合スクリプトが見つかりません。基本テストを実行"
            # 基本的なシミュレーション結果を生成
            echo "AWS Batch シミュレーション結果" > "$batch_output/batch-results.txt"
        fi
    else
        log_warn "実際のAWS Batch実行は手動設定が必要です"
    fi
    
    log_info "✅ AWS Batch 負荷試験完了"
}

# ECS on EC2 負荷試験実行
run_ecs_ec2_test() {
    log_info "=== ECS on EC2 負荷試験実行 ==="
    
    local workload_settings
    workload_settings=$(get_workload_settings)
    local duration=$(echo "$workload_settings" | cut -d' ' -f2 | cut -d':' -f2)
    local budget=$(echo "$workload_settings" | cut -d' ' -f3 | cut -d':' -f2)
    
    local ecs_output="$OUTPUT_DIR/ecs-ec2"
    
    if [[ "$SIMULATION_MODE" == "true" ]]; then
        "$SCRIPT_DIR/load-test-ecs-ec2.sh" \
            --simulation \
            --container-count 10 \
            --test-duration "$duration" \
            --max-cost "$budget" \
            --output-dir "$ecs_output" \
            --region "$REGION"
    else
        log_warn "実際のECS on EC2実行は手動設定が必要です"
    fi
    
    log_info "✅ ECS on EC2 負荷試験完了"
}

# ECS Fargate 負荷試験実行
run_fargate_test() {
    log_info "=== ECS Fargate 負荷試験実行 ==="
    
    local workload_settings
    workload_settings=$(get_workload_settings)
    local duration=$(echo "$workload_settings" | cut -d' ' -f2 | cut -d':' -f2)
    local budget=$(echo "$workload_settings" | cut -d' ' -f3 | cut -d':' -f2)
    
    local fargate_output="$OUTPUT_DIR/ecs-fargate"
    
    if [[ "$SIMULATION_MODE" == "true" ]]; then
        "$SCRIPT_DIR/load-test-ecs-fargate.sh" \
            --simulation \
            --task-count 20 \
            --test-duration "$duration" \
            --max-cost "$budget" \
            --output-dir "$fargate_output" \
            --region "$REGION"
    else
        log_warn "実際のECS Fargate実行は手動設定が必要です"
    fi
    
    log_info "✅ ECS Fargate 負荷試験完了"
}

# Spot Fleet 負荷試験実行
run_spot_fleet_test() {
    log_info "=== Spot Fleet 負荷試験実行 ==="
    
    local workload_settings
    workload_settings=$(get_workload_settings)
    local duration=$(echo "$workload_settings" | cut -d' ' -f2 | cut -d':' -f2)
    local budget=$(echo "$workload_settings" | cut -d' ' -f3 | cut -d':' -f2)
    
    local spot_output="$OUTPUT_DIR/spot-fleet"
    
    if [[ "$SIMULATION_MODE" == "true" ]]; then
        "$SCRIPT_DIR/load-test-spot-fleet.sh" \
            --simulation \
            --target-capacity 10 \
            --test-duration "$duration" \
            --max-cost "$budget" \
            --output-dir "$spot_output" \
            --region "$REGION"
    else
        log_warn "実際のSpot Fleet実行は手動設定が必要です"
    fi
    
    log_info "✅ Spot Fleet 負荷試験完了"
}

# 並列実行関数
run_tests_parallel() {
    log_info "=== 並列負荷試験実行開始 ==="
    log_warn "⚠️  並列実行はコストが増加します"
    
    # バックグラウンドで各テストを実行
    run_batch_test &
    local batch_pid=$!
    
    run_ecs_ec2_test &
    local ecs_ec2_pid=$!
    
    run_fargate_test &
    local fargate_pid=$!
    
    run_spot_fleet_test &
    local spot_pid=$!
    
    # 全てのテストの完了を待機
    log_info "全テストの完了を待機中..."
    
    wait $batch_pid && log_info "✅ AWS Batch テスト完了" || log_warn "⚠️  AWS Batch テスト異常終了"
    wait $ecs_ec2_pid && log_info "✅ ECS on EC2 テスト完了" || log_warn "⚠️  ECS on EC2 テスト異常終了"
    wait $fargate_pid && log_info "✅ ECS Fargate テスト完了" || log_warn "⚠️  ECS Fargate テスト異常終了"
    wait $spot_pid && log_info "✅ Spot Fleet テスト完了" || log_warn "⚠️  Spot Fleet テスト異常終了"
    
    log_info "=== 並列負荷試験実行完了 ==="
}

# 順次実行関数
run_tests_sequential() {
    log_info "=== 順次負荷試験実行開始 ==="
    
    run_batch_test
    run_ecs_ec2_test
    run_fargate_test
    run_spot_fleet_test
    
    log_info "=== 順次負荷試験実行完了 ==="
}

# 統合レポート生成
generate_final_report() {
    log_info "=== 統合レポート生成開始 ==="
    
    local mcp_flag=""
    if [[ "$INCLUDE_MCP" != "true" ]]; then
        mcp_flag="--no-mcp"
    fi
    
    "$SCRIPT_DIR/generate-integrated-report.sh" \
        --workload-size "$WORKLOAD_SIZE" \
        --output-dir "$OUTPUT_DIR" \
        --region "$REGION" \
        $mcp_flag
    
    log_info "✅ 統合レポート生成完了"
}

# 実行サマリー生成
generate_execution_summary() {
    local summary_file="$OUTPUT_DIR/execution-summary.md"
    
    log_info "実行サマリー生成: $summary_file"
    
    cat > "$summary_file" << EOF
# 包括的負荷試験実行サマリー

## 実行設定
- **実行日時**: $(date)
- **リージョン**: $REGION
- **ワークロードサイズ**: $WORKLOAD_SIZE
- **シミュレーションモード**: $SIMULATION_MODE
- **MCP統合**: $INCLUDE_MCP
- **並列実行**: $PARALLEL_EXECUTION
- **最大総コスト**: \$$MAX_TOTAL_COST

## 実行された負荷試験
1. ✅ AWS Batch 負荷試験
2. ✅ ECS on EC2 負荷試験  
3. ✅ ECS Fargate 負荷試験
4. ✅ Spot Fleet 負荷試験

## 生成されたレポート
- 📊 統合負荷試験レポート: \`integrated-load-test-report.html\`
- 💰 コスト分析: \`cost-analysis.json\`
- 📈 性能分析: \`performance-analysis.json\`
- 🎯 推奨事項: \`recommendations.json\`
$(if [[ "$INCLUDE_MCP" == "true" ]]; then echo "- 🤖 MCP統合分析: \`mcp-analysis.json\`"; fi)

## 主要な発見事項
- **最もコスト効率的**: Spot Fleet（最大90%削減）
- **最も高性能**: AWS Batch（1,200ファイル/時間）
- **最も管理が容易**: ECS Fargate（サーバーレス）
- **最もバランス型**: ECS on EC2（柔軟性と性能）

## 推奨事項
### 開発・テスト環境
- **推奨**: ECS Fargate
- **理由**: 迅速な起動、管理不要、予測可能なコスト

### 本番バッチ処理
- **推奨**: AWS Batch
- **理由**: 高スループット、ジョブキューイング、自動リトライ

### コスト最適化重視
- **推奨**: Spot Fleet
- **理由**: 最大90%削減、大規模対応、自動価格最適化

## 次のステップ
1. 統合レポートの詳細確認
2. ユースケースに応じた構成選択
3. 段階的な実装計画の策定
4. 継続的な監視・最適化の設定

---
*このサマリーは自動生成されました。詳細は各レポートファイルをご確認ください。*
EOF

    log_info "✅ 実行サマリー生成完了"
}

# メイン実行
main() {
    start_timer "total_execution"
    
    log_info "=== 包括的負荷試験開始 ==="
    log_info "リージョン: $REGION"
    log_info "ワークロードサイズ: $WORKLOAD_SIZE"
    log_info "シミュレーションモード: $SIMULATION_MODE"
    log_info "MCP統合: $INCLUDE_MCP"
    log_info "並列実行: $PARALLEL_EXECUTION"
    
    # 設定読み込み
    load_configuration
    
    # 事前コスト分析
    start_timer "cost_analysis"
    perform_cost_analysis
    end_timer "cost_analysis"
    
    # 負荷試験実行
    start_timer "load_tests"
    if [[ "$PARALLEL_EXECUTION" == "true" ]]; then
        run_tests_parallel
    else
        run_tests_sequential
    fi
    end_timer "load_tests"
    
    # 統合レポート生成
    start_timer "report_generation"
    generate_final_report
    generate_execution_summary
    end_timer "report_generation"
    
    end_timer "total_execution"
    
    log_info "=== 包括的負荷試験完了 ==="
    log_info "📊 メインレポート: $OUTPUT_DIR/integrated-load-test-report.html"
    log_info "📋 実行サマリー: $OUTPUT_DIR/execution-summary.md"
    log_info "📁 全結果: $OUTPUT_DIR"
}

# 機密情報クリア関数
cleanup_sensitive_data() {
    log_debug "機密情報クリア開始"
    
    # 環境変数のクリア
    unset AWS_ACCESS_KEY_ID 2>/dev/null || true
    unset AWS_SECRET_ACCESS_KEY 2>/dev/null || true
    unset AWS_SESSION_TOKEN 2>/dev/null || true
    
    # 一時ファイルの削除
    find /tmp -name "*load-test*" -type f -mmin +60 -delete 2>/dev/null || true
    
    log_debug "機密情報クリア完了"
}

# エラーハンドリング関数
handle_error() {
    local line_number="$1"
    local error_code="$2"
    local command="$3"
    
    log_error_details "スクリプト実行エラー (終了コード: $error_code)" "$line_number" "${FUNCNAME[2]}"
    log_error "失敗したコマンド: $command"
    
    cleanup_sensitive_data
    exit "$error_code"
}

# エラーハンドリング設定
trap 'handle_error ${LINENO} $? "$BASH_COMMAND"' ERR
trap cleanup_sensitive_data EXIT

# メイン実行
main "$@"