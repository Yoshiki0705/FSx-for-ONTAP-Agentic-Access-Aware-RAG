#!/bin/bash

# ECS on EC2 負荷試験スクリプト
# コンテナベースの埋め込み生成負荷試験とリソース効率分析

set -euo pipefail

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ログ関数
log_info() {
    echo -e "\\033[32m[INFO]\\033[0m $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_error() {
    echo -e "\\033[31m[ERROR]\\033[0m $(date '+%Y-%m-%d %H:%M:%S') $1" >&2
}

log_cost() {
    echo -e "\\033[34m[COST]\\033[0m $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_warn() {
    echo -e "\\033[33m[WARN]\\033[0m $(date '+%Y-%m-%d %H:%M:%S') $1"
}

# デフォルト設定
REGION="${AWS_DEFAULT_REGION:-ap-northeast-1}"
CLUSTER_NAME="rag-ecs-cluster"
SERVICE_NAME="rag-embedding-service"
TASK_DEFINITION="rag-embedding-task"
CONTAINER_COUNT=10
TEST_DURATION=900  # 15分
MAX_COST=50.00
SIMULATION_MODE=false
OUTPUT_DIR=""

# 使用方法を表示
show_usage() {
    cat << EOF
使用方法: $0 [オプション]

ECS on EC2 負荷試験オプション:
  --cluster-name NAME        ECSクラスター名 (デフォルト: $CLUSTER_NAME)
  --service-name NAME        ECSサービス名 (デフォルト: $SERVICE_NAME)
  --container-count COUNT    コンテナ数 (デフォルト: $CONTAINER_COUNT)
  --test-duration SECONDS    テスト時間（秒） (デフォルト: $TEST_DURATION)
  --max-cost AMOUNT          最大コスト制限 (デフォルト: $MAX_COST)
  --region REGION            AWSリージョン (デフォルト: $REGION)
  --simulation               シミュレーションモード
  --output-dir DIR           出力ディレクトリ
  --help                     このヘルプを表示

例:
  $0 --container-count 20 --test-duration 1800 --max-cost 75.00
  $0 --simulation --container-count 5
EOF
}

# パラメータ解析
while [[ $# -gt 0 ]]; do
    case $1 in
        --cluster-name)
            CLUSTER_NAME="$2"
            shift 2
            ;;
        --service-name)
            SERVICE_NAME="$2"
            shift 2
            ;;
        --container-count)
            CONTAINER_COUNT="$2"
            shift 2
            ;;
        --test-duration)
            TEST_DURATION="$2"
            shift 2
            ;;
        --max-cost)
            MAX_COST="$2"
            shift 2
            ;;
        --region)
            REGION="$2"
            shift 2
            ;;
        --simulation)
            SIMULATION_MODE=true
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
    OUTPUT_DIR="$PROJECT_ROOT/reports/ecs-ec2-test-$(date +%Y%m%d-%H%M%S)"
fi

# 出力ディレクトリの作成
mkdir -p "$OUTPUT_DIR"
log_info "出力ディレクトリ: $OUTPUT_DIR"

# ECSクラスター存在確認
check_ecs_cluster() {
    if [[ "$SIMULATION_MODE" == "true" ]]; then
        log_info "シミュレーションモード: ECSクラスター確認をスキップ"
        return 0
    fi
    
    log_info "ECSクラスター確認: $CLUSTER_NAME"
    
    if aws ecs describe-clusters \
        --clusters "$CLUSTER_NAME" \
        --region "$REGION" \
        --query 'clusters[0].status' \
        --output text 2>/dev/null | grep -q "ACTIVE"; then
        log_info "✅ ECSクラスター確認完了: $CLUSTER_NAME"
        return 0
    else
        log_error "❌ ECSクラスターが見つからないか非アクティブ: $CLUSTER_NAME"
        return 1
    fi
}

# EC2インスタンス情報取得
get_ec2_instances() {
    if [[ "$SIMULATION_MODE" == "true" ]]; then
        echo "シミュレーション用EC2インスタンス情報"
        return 0
    fi
    
    log_info "EC2インスタンス情報取得中..."
    
    aws ecs list-container-instances \
        --cluster "$CLUSTER_NAME" \
        --region "$REGION" \
        --query 'containerInstanceArns' \
        --output text 2>/dev/null || echo "インスタンス情報取得失敗"
}

# コスト見積もり
estimate_cost() {
    local container_count=$1
    local duration_hours=$(echo "scale=2; $TEST_DURATION / 3600" | bc -l)
    
    # EC2インスタンスコスト（t3.medium想定: $0.0416/時間）
    local ec2_cost=$(echo "scale=2; 0.0416 * $duration_hours * ($container_count / 10)" | bc -l)
    
    # ECSタスクコスト（追加料金なし）
    local ecs_cost=0.00
    
    # データ転送コスト（最小限）
    local transfer_cost=$(echo "scale=2; 0.01 * $container_count" | bc -l)
    
    local total_cost=$(echo "scale=2; $ec2_cost + $ecs_cost + $transfer_cost" | bc -l)
    
    log_cost "💰 ECS on EC2 コスト見積もり（$duration_hours 時間）:"
    log_cost "   - EC2インスタンス: \$$ec2_cost"
    log_cost "   - ECSタスク: \$$ecs_cost"
    log_cost "   - データ転送: \$$transfer_cost"
    log_cost "   - 合計予想コスト: \$$total_cost"
    
    # コスト制限チェック
    if (( $(echo "$total_cost > $MAX_COST" | bc -l) )); then
        log_error "予想コスト（\$$total_cost）が制限（\$$MAX_COST）を超過"
        return 1
    fi
    
    echo "$total_cost"
}

# ECSサービス作成/更新
setup_ecs_service() {
    if [[ "$SIMULATION_MODE" == "true" ]]; then
        log_info "シミュレーションモード: ECSサービス設定をスキップ"
        return 0
    fi
    
    log_info "ECSサービス設定: $SERVICE_NAME"
    
    # サービス存在確認
    if aws ecs describe-services \
        --cluster "$CLUSTER_NAME" \
        --services "$SERVICE_NAME" \
        --region "$REGION" \
        --query 'services[0].status' \
        --output text 2>/dev/null | grep -q "ACTIVE"; then
        
        log_info "既存サービスを更新: $SERVICE_NAME"
        aws ecs update-service \
            --cluster "$CLUSTER_NAME" \
            --service "$SERVICE_NAME" \
            --desired-count "$CONTAINER_COUNT" \
            --region "$REGION" >/dev/null
    else
        log_info "新規サービスを作成: $SERVICE_NAME"
        # 実際の環境では適切なタスク定義とサービス設定が必要
        log_warn "サービス作成は手動で実行してください"
    fi
}

# 負荷試験実行
run_load_test() {
    local start_time=$(date +%s)
    local end_time=$((start_time + TEST_DURATION))
    
    log_info "=== ECS on EC2 負荷試験開始 ==="
    log_info "コンテナ数: $CONTAINER_COUNT"
    log_info "テスト時間: $TEST_DURATION 秒"
    log_info "開始時刻: $(date)"
    
    # メトリクス収集開始
    local metrics_file="$OUTPUT_DIR/ecs-metrics.json"
    
    while [[ $(date +%s) -lt $end_time ]]; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        # 進捗表示
        if (( elapsed % 60 == 0 )); then
            local remaining=$((end_time - current_time))
            log_info "進捗: ${elapsed}秒経過, 残り${remaining}秒"
        fi
        
        # メトリクス収集
        collect_metrics "$metrics_file"
        
        sleep 10
    done
    
    log_info "=== ECS on EC2 負荷試験完了 ==="
    log_info "終了時刻: $(date)"
}

# メトリクス収集
collect_metrics() {
    local metrics_file="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    if [[ "$SIMULATION_MODE" == "true" ]]; then
        # シミュレーション用のダミーメトリクス
        cat >> "$metrics_file" << EOF
{
  "timestamp": "$timestamp",
  "cluster": "$CLUSTER_NAME",
  "service": "$SERVICE_NAME",
  "running_tasks": $((CONTAINER_COUNT + RANDOM % 3 - 1)),
  "pending_tasks": $((RANDOM % 3)),
  "cpu_utilization": $((40 + RANDOM % 40)),
  "memory_utilization": $((30 + RANDOM % 50)),
  "network_rx_bytes": $((1000000 + RANDOM % 500000)),
  "network_tx_bytes": $((800000 + RANDOM % 400000))
}
EOF
    else
        # 実際のメトリクス収集
        local running_tasks=$(aws ecs describe-services \
            --cluster "$CLUSTER_NAME" \
            --services "$SERVICE_NAME" \
            --region "$REGION" \
            --query 'services[0].runningCount' \
            --output text 2>/dev/null || echo "0")
        
        local pending_tasks=$(aws ecs describe-services \
            --cluster "$CLUSTER_NAME" \
            --services "$SERVICE_NAME" \
            --region "$REGION" \
            --query 'services[0].pendingCount' \
            --output text 2>/dev/null || echo "0")
        
        cat >> "$metrics_file" << EOF
{
  "timestamp": "$timestamp",
  "cluster": "$CLUSTER_NAME",
  "service": "$SERVICE_NAME",
  "running_tasks": $running_tasks,
  "pending_tasks": $pending_tasks,
  "cpu_utilization": "N/A",
  "memory_utilization": "N/A",
  "network_rx_bytes": "N/A",
  "network_tx_bytes": "N/A"
}
EOF
    fi
}

# レポート生成
generate_report() {
    local report_file="$OUTPUT_DIR/ecs-ec2-load-test-report.html"
    
    log_info "レポート生成中: $report_file"
    
    cat > "$report_file" << EOF
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ECS on EC2 負荷試験レポート</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f0f8ff; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .metric-card { background: #f9f9f9; padding: 15px; border-radius: 5px; text-align: center; }
        .cost-section { background-color: #fff3cd; }
        .performance-section { background-color: #d1ecf1; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🐳 ECS on EC2 負荷試験レポート</h1>
        <p><strong>実行日時:</strong> $(date)</p>
        <p><strong>リージョン:</strong> $REGION</p>
        <p><strong>シミュレーションモード:</strong> $SIMULATION_MODE</p>
    </div>

    <div class="section">
        <h2>📊 テスト設定</h2>
        <table>
            <tr><th>項目</th><th>値</th></tr>
            <tr><td>ECSクラスター</td><td>$CLUSTER_NAME</td></tr>
            <tr><td>ECSサービス</td><td>$SERVICE_NAME</td></tr>
            <tr><td>コンテナ数</td><td>$CONTAINER_COUNT</td></tr>
            <tr><td>テスト時間</td><td>$TEST_DURATION 秒</td></tr>
            <tr><td>最大コスト制限</td><td>\$$MAX_COST</td></tr>
        </table>
    </div>

    <div class="section cost-section">
        <h2>💰 コスト分析</h2>
        <div class="metrics">
            <div class="metric-card">
                <h3>予想総コスト</h3>
                <p style="font-size: 24px; color: #007bff;">\$$(estimate_cost "$CONTAINER_COUNT")</p>
            </div>
            <div class="metric-card">
                <h3>時間あたりコスト</h3>
                <p style="font-size: 20px;">\$$(echo "scale=2; $(estimate_cost "$CONTAINER_COUNT") / ($TEST_DURATION / 3600)" | bc -l)</p>
            </div>
            <div class="metric-card">
                <h3>コンテナあたりコスト</h3>
                <p style="font-size: 20px;">\$$(echo "scale=4; $(estimate_cost "$CONTAINER_COUNT") / $CONTAINER_COUNT" | bc -l)</p>
            </div>
        </div>
    </div>

    <div class="section performance-section">
        <h2>⚡ 性能分析</h2>
        <p><strong>ECS on EC2の特徴:</strong></p>
        <ul>
            <li>EC2インスタンスの完全制御</li>
            <li>カスタムAMIとインスタンス設定</li>
            <li>永続的なローカルストレージ</li>
            <li>ネットワーク性能の最適化</li>
            <li>コスト効率的な長時間実行</li>
        </ul>
        
        <h3>推奨ユースケース</h3>
        <ul>
            <li>長時間実行のバッチ処理</li>
            <li>高いネットワーク性能が必要な処理</li>
            <li>カスタム環境設定が必要な処理</li>
            <li>コスト最適化が重要な処理</li>
        </ul>
    </div>

    <div class="section">
        <h2>📈 最適化推奨事項</h2>
        <h3>コスト最適化</h3>
        <ul>
            <li>スポットインスタンスの活用（最大90%削減）</li>
            <li>リザーブドインスタンスの検討（最大75%削減）</li>
            <li>オートスケーリングによる適応的リソース管理</li>
            <li>適切なインスタンスタイプの選択</li>
        </ul>
        
        <h3>性能最適化</h3>
        <ul>
            <li>EBS最適化インスタンスの使用</li>
            <li>拡張ネットワーキング（SR-IOV）の有効化</li>
            <li>プレイスメントグループの活用</li>
            <li>コンテナリソース制限の最適化</li>
        </ul>
    </div>

    <div class="section">
        <h2>🔗 関連リソース</h2>
        <ul>
            <li><a href="https://docs.aws.amazon.com/ecs/latest/developerguide/ECS_instances.html">ECS Container Instances</a></li>
            <li><a href="https://docs.aws.amazon.com/ecs/latest/developerguide/service-auto-scaling.html">ECS Service Auto Scaling</a></li>
            <li><a href="https://aws.amazon.com/ec2/spot/">Amazon EC2 Spot Instances</a></li>
        </ul>
    </div>
</body>
</html>
EOF

    log_info "✅ レポート生成完了: $report_file"
}

# クリーンアップ
cleanup() {
    if [[ "$SIMULATION_MODE" == "true" ]]; then
        log_info "シミュレーションモード: クリーンアップをスキップ"
        return 0
    fi
    
    log_info "クリーンアップ実行中..."
    
    # ECSサービスのタスク数を0に設定
    if aws ecs describe-services \
        --cluster "$CLUSTER_NAME" \
        --services "$SERVICE_NAME" \
        --region "$REGION" \
        --query 'services[0].status' \
        --output text 2>/dev/null | grep -q "ACTIVE"; then
        
        log_info "ECSサービスのタスク数を0に設定"
        aws ecs update-service \
            --cluster "$CLUSTER_NAME" \
            --service "$SERVICE_NAME" \
            --desired-count 0 \
            --region "$REGION" >/dev/null
    fi
}

# メイン実行
main() {
    log_info "=== ECS on EC2 負荷試験開始 ==="
    log_info "リージョン: $REGION"
    log_info "シミュレーションモード: $SIMULATION_MODE"
    
    # 事前チェック
    if ! check_ecs_cluster; then
        exit 1
    fi
    
    # コスト見積もり
    local estimated_cost
    estimated_cost=$(estimate_cost "$CONTAINER_COUNT")
    
    # EC2インスタンス情報取得
    get_ec2_instances
    
    # ECSサービス設定
    setup_ecs_service
    
    # 負荷試験実行
    run_load_test
    
    # レポート生成
    generate_report
    
    # クリーンアップ
    cleanup
    
    log_info "=== ECS on EC2 負荷試験完了 ==="
    log_info "レポート: $OUTPUT_DIR"
}

# シグナルハンドラー設定
trap cleanup EXIT INT TERM

# メイン実行
main "$@"