#!/bin/bash

# ECS Fargate 負荷試験スクリプト
# サーバーレスコンテナでの軽量ワークロード負荷試験

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
CLUSTER_NAME="rag-fargate-cluster"
SERVICE_NAME="rag-fargate-service"
TASK_DEFINITION="rag-fargate-task"
TASK_COUNT=20
TEST_DURATION=600  # 10分
MAX_COST=75.00
SIMULATION_MODE=false
OUTPUT_DIR=""
CPU_UNITS=256      # 0.25 vCPU
MEMORY_MB=512      # 512 MB

# 使用方法を表示
show_usage() {
    cat << EOF
使用方法: $0 [オプション]

ECS Fargate 負荷試験オプション:
  --cluster-name NAME        ECSクラスター名 (デフォルト: $CLUSTER_NAME)
  --service-name NAME        ECSサービス名 (デフォルト: $SERVICE_NAME)
  --task-count COUNT         タスク数 (デフォルト: $TASK_COUNT)
  --test-duration SECONDS    テスト時間（秒） (デフォルト: $TEST_DURATION)
  --max-cost AMOUNT          最大コスト制限 (デフォルト: $MAX_COST)
  --cpu-units UNITS          CPU単位 (デフォルト: $CPU_UNITS)
  --memory-mb MB             メモリ（MB） (デフォルト: $MEMORY_MB)
  --region REGION            AWSリージョン (デフォルト: $REGION)
  --simulation               シミュレーションモード
  --output-dir DIR           出力ディレクトリ
  --help                     このヘルプを表示

例:
  $0 --task-count 50 --test-duration 1200 --max-cost 100.00
  $0 --simulation --task-count 10 --cpu-units 512 --memory-mb 1024
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
        --task-count)
            TASK_COUNT="$2"
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
        --cpu-units)
            CPU_UNITS="$2"
            shift 2
            ;;
        --memory-mb)
            MEMORY_MB="$2"
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
    OUTPUT_DIR="$PROJECT_ROOT/reports/ecs-fargate-test-$(date +%Y%m%d-%H%M%S)"
fi

# 出力ディレクトリの作成
mkdir -p "$OUTPUT_DIR"
log_info "出力ディレクトリ: $OUTPUT_DIR"

# Fargateコスト計算
calculate_fargate_cost() {
    local task_count=$1
    local cpu_units=$2
    local memory_mb=$3
    local duration_hours=$(echo "scale=2; $TEST_DURATION / 3600" | bc -l)
    
    # Fargate料金（東京リージョン）
    # CPU: $0.04656 per vCPU per hour
    # Memory: $0.00511 per GB per hour
    
    local vcpu=$(echo "scale=4; $cpu_units / 1024" | bc -l)
    local memory_gb=$(echo "scale=4; $memory_mb / 1024" | bc -l)
    
    local cpu_cost=$(echo "scale=4; $vcpu * 0.04656 * $duration_hours * $task_count" | bc -l)
    local memory_cost=$(echo "scale=4; $memory_gb * 0.00511 * $duration_hours * $task_count" | bc -l)
    
    # データ転送コスト（最小限）
    local transfer_cost=$(echo "scale=2; 0.005 * $task_count" | bc -l)
    
    local total_cost=$(echo "scale=2; $cpu_cost + $memory_cost + $transfer_cost" | bc -l)
    
    log_cost "💰 ECS Fargate コスト見積もり（$duration_hours 時間）:"
    log_cost "   - CPU ($vcpu vCPU × $task_count タスク): \$$cpu_cost"
    log_cost "   - Memory ($memory_gb GB × $task_count タスク): \$$memory_cost"
    log_cost "   - データ転送: \$$transfer_cost"
    log_cost "   - 合計予想コスト: \$$total_cost"
    
    # コスト制限チェック
    if (( $(echo "$total_cost > $MAX_COST" | bc -l) )); then
        log_error "予想コスト（\$$total_cost）が制限（\$$MAX_COST）を超過"
        return 1
    fi
    
    echo "$total_cost"
}

# コールドスタート時間測定
measure_cold_start() {
    if [[ "$SIMULATION_MODE" == "true" ]]; then
        # シミュレーション用のランダムな値
        local cold_start_time=$((2000 + RANDOM % 3000))  # 2-5秒
        log_info "シミュレーション: コールドスタート時間 ${cold_start_time}ms"
        echo "$cold_start_time"
        return 0
    fi
    
    log_info "コールドスタート時間測定開始..."
    
    local start_time=$(date +%s%3N)
    
    # 新しいタスクを1つ起動
    local task_arn
    task_arn=$(aws ecs run-task \
        --cluster "$CLUSTER_NAME" \
        --task-definition "$TASK_DEFINITION" \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[subnet-12345],securityGroups=[sg-12345],assignPublicIp=ENABLED}" \
        --region "$REGION" \
        --query 'tasks[0].taskArn' \
        --output text 2>/dev/null || echo "FAILED")
    
    if [[ "$task_arn" == "FAILED" ]]; then
        log_error "タスク起動失敗"
        echo "0"
        return 1
    fi
    
    # タスクがRUNNING状態になるまで待機
    while true; do
        local status
        status=$(aws ecs describe-tasks \
            --cluster "$CLUSTER_NAME" \
            --tasks "$task_arn" \
            --region "$REGION" \
            --query 'tasks[0].lastStatus' \
            --output text 2>/dev/null || echo "UNKNOWN")
        
        if [[ "$status" == "RUNNING" ]]; then
            break
        elif [[ "$status" == "STOPPED" ]]; then
            log_error "タスクが停止しました"
            echo "0"
            return 1
        fi
        
        sleep 1
    done
    
    local end_time=$(date +%s%3N)
    local cold_start_time=$((end_time - start_time))
    
    # テストタスクを停止
    aws ecs stop-task \
        --cluster "$CLUSTER_NAME" \
        --task "$task_arn" \
        --region "$REGION" >/dev/null 2>&1
    
    log_info "コールドスタート時間: ${cold_start_time}ms"
    echo "$cold_start_time"
}

# Fargateタスク実行
run_fargate_tasks() {
    local start_time=$(date +%s)
    local end_time=$((start_time + TEST_DURATION))
    
    log_info "=== ECS Fargate 負荷試験開始 ==="
    log_info "タスク数: $TASK_COUNT"
    log_info "CPU: $CPU_UNITS units ($(echo "scale=2; $CPU_UNITS / 1024" | bc -l) vCPU)"
    log_info "Memory: $MEMORY_MB MB"
    log_info "テスト時間: $TEST_DURATION 秒"
    log_info "開始時刻: $(date)"
    
    # メトリクス収集ファイル
    local metrics_file="$OUTPUT_DIR/fargate-metrics.json"
    local cold_start_file="$OUTPUT_DIR/cold-start-times.json"
    
    # コールドスタート時間測定
    local cold_start_time
    cold_start_time=$(measure_cold_start)
    
    echo "{\"timestamp\": \"$(date '+%Y-%m-%d %H:%M:%S')\", \"cold_start_ms\": $cold_start_time}" > "$cold_start_file"
    
    # タスク起動（シミュレーションモード）
    if [[ "$SIMULATION_MODE" == "true" ]]; then
        log_info "シミュレーションモード: Fargateタスクをシミュレート"
        
        while [[ $(date +%s) -lt $end_time ]]; do
            local current_time=$(date +%s)
            local elapsed=$((current_time - start_time))
            
            # 進捗表示
            if (( elapsed % 60 == 0 )); then
                local remaining=$((end_time - current_time))
                log_info "進捗: ${elapsed}秒経過, 残り${remaining}秒"
            fi
            
            # シミュレーションメトリクス
            collect_fargate_metrics "$metrics_file" "simulation"
            
            sleep 10
        done
    else
        log_warn "実際のFargateタスク実行は手動で設定してください"
        log_warn "適切なタスク定義とネットワーク設定が必要です"
    fi
    
    log_info "=== ECS Fargate 負荷試験完了 ==="
    log_info "終了時刻: $(date)"
}

# Fargateメトリクス収集
collect_fargate_metrics() {
    local metrics_file="$1"
    local mode="${2:-real}"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    if [[ "$mode" == "simulation" ]]; then
        # シミュレーション用メトリクス
        local running_tasks=$((TASK_COUNT + RANDOM % 5 - 2))
        local pending_tasks=$((RANDOM % 3))
        local cpu_utilization=$((20 + RANDOM % 60))
        local memory_utilization=$((15 + RANDOM % 70))
        
        cat >> "$metrics_file" << EOF
{
  "timestamp": "$timestamp",
  "cluster": "$CLUSTER_NAME",
  "service": "$SERVICE_NAME",
  "running_tasks": $running_tasks,
  "pending_tasks": $pending_tasks,
  "cpu_utilization": $cpu_utilization,
  "memory_utilization": $memory_utilization,
  "launch_type": "FARGATE",
  "cpu_units": $CPU_UNITS,
  "memory_mb": $MEMORY_MB
}
EOF
    else
        # 実際のメトリクス収集（実装時に追加）
        log_info "実際のメトリクス収集: $timestamp"
    fi
}

# Fargateレポート生成
generate_fargate_report() {
    local report_file="$OUTPUT_DIR/ecs-fargate-load-test-report.html"
    local estimated_cost
    estimated_cost=$(calculate_fargate_cost "$TASK_COUNT" "$CPU_UNITS" "$MEMORY_MB")
    
    log_info "Fargateレポート生成中: $report_file"
    
    cat > "$report_file" << EOF
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ECS Fargate 負荷試験レポート</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #e8f5e8; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .metric-card { background: #f9f9f9; padding: 15px; border-radius: 5px; text-align: center; }
        .cost-section { background-color: #fff3cd; }
        .performance-section { background-color: #d4edda; }
        .cold-start-section { background-color: #f8d7da; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .advantage { color: #28a745; font-weight: bold; }
        .disadvantage { color: #dc3545; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 ECS Fargate 負荷試験レポート</h1>
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
            <tr><td>タスク数</td><td>$TASK_COUNT</td></tr>
            <tr><td>CPU</td><td>$CPU_UNITS units ($(echo "scale=2; $CPU_UNITS / 1024" | bc -l) vCPU)</td></tr>
            <tr><td>Memory</td><td>$MEMORY_MB MB</td></tr>
            <tr><td>テスト時間</td><td>$TEST_DURATION 秒</td></tr>
            <tr><td>最大コスト制限</td><td>\$$MAX_COST</td></tr>
        </table>
    </div>

    <div class="section cost-section">
        <h2>💰 コスト分析</h2>
        <div class="metrics">
            <div class="metric-card">
                <h3>予想総コスト</h3>
                <p style="font-size: 24px; color: #007bff;">\$$estimated_cost</p>
            </div>
            <div class="metric-card">
                <h3>時間あたりコスト</h3>
                <p style="font-size: 20px;">\$$(echo "scale=2; $estimated_cost / ($TEST_DURATION / 3600)" | bc -l)</p>
            </div>
            <div class="metric-card">
                <h3>タスクあたりコスト</h3>
                <p style="font-size: 20px;">\$$(echo "scale=4; $estimated_cost / $TASK_COUNT" | bc -l)</p>
            </div>
        </div>
        
        <h3>💡 Fargateコスト特徴</h3>
        <ul>
            <li class="advantage">✅ インフラ管理コスト不要</li>
            <li class="advantage">✅ 使用した分だけの課金</li>
            <li class="advantage">✅ 最小リソースから開始可能</li>
            <li class="disadvantage">❌ 長時間実行では割高</li>
            <li class="disadvantage">❌ EC2と比較して20-50%高コスト</li>
        </ul>
    </div>

    <div class="section cold-start-section">
        <h2>🕐 コールドスタート分析</h2>
        <div class="metrics">
            <div class="metric-card">
                <h3>コールドスタート時間</h3>
                <p style="font-size: 24px; color: #dc3545;">$(measure_cold_start)ms</p>
            </div>
            <div class="metric-card">
                <h3>推奨最適化</h3>
                <p>コンテナイメージサイズ削減</p>
            </div>
        </div>
        
        <h3>🚀 コールドスタート最適化</h3>
        <ul>
            <li>軽量ベースイメージの使用（Alpine Linux等）</li>
            <li>マルチステージビルドでイメージサイズ削減</li>
            <li>不要なパッケージの除去</li>
            <li>アプリケーション起動時間の最適化</li>
        </ul>
    </div>

    <div class="section performance-section">
        <h2>⚡ 性能分析</h2>
        <h3>🎯 Fargateの利点</h3>
        <ul>
            <li class="advantage">サーバー管理不要</li>
            <li class="advantage">自動スケーリング</li>
            <li class="advantage">セキュリティパッチ自動適用</li>
            <li class="advantage">高可用性設計</li>
            <li class="advantage">VPCネイティブネットワーキング</li>
        </ul>
        
        <h3>⚠️ 制限事項</h3>
        <ul>
            <li class="disadvantage">永続ストレージ制限（20GB EBS）</li>
            <li class="disadvantage">GPUサポートなし</li>
            <li class="disadvantage">カスタムAMI使用不可</li>
            <li class="disadvantage">特権モード制限</li>
        </ul>
        
        <h3>📈 推奨ユースケース</h3>
        <ul>
            <li>短時間〜中時間のバッチ処理</li>
            <li>イベント駆動型処理</li>
            <li>マイクロサービスアーキテクチャ</li>
            <li>開発・テスト環境</li>
            <li>スパイクトラフィック対応</li>
        </ul>
    </div>

    <div class="section">
        <h2>📊 EC2 vs Fargate 比較</h2>
        <table>
            <tr><th>項目</th><th>EC2</th><th>Fargate</th></tr>
            <tr><td>管理負荷</td><td class="disadvantage">高い</td><td class="advantage">低い</td></tr>
            <tr><td>コスト（短時間）</td><td class="disadvantage">高い</td><td class="advantage">低い</td></tr>
            <tr><td>コスト（長時間）</td><td class="advantage">低い</td><td class="disadvantage">高い</td></tr>
            <tr><td>カスタマイズ性</td><td class="advantage">高い</td><td class="disadvantage">制限あり</td></tr>
            <tr><td>起動時間</td><td class="disadvantage">遅い</td><td class="advantage">速い</td></tr>
            <tr><td>スケーラビリティ</td><td class="disadvantage">制限あり</td><td class="advantage">高い</td></tr>
        </table>
    </div>

    <div class="section">
        <h2>🔗 関連リソース</h2>
        <ul>
            <li><a href="https://docs.aws.amazon.com/ecs/latest/developerguide/AWS_Fargate.html">AWS Fargate</a></li>
            <li><a href="https://aws.amazon.com/fargate/pricing/">Fargate Pricing</a></li>
            <li><a href="https://docs.aws.amazon.com/ecs/latest/bestpracticesguide/fargate.html">Fargate Best Practices</a></li>
        </ul>
    </div>
</body>
</html>
EOF

    log_info "✅ Fargateレポート生成完了: $report_file"
}

# メイン実行
main() {
    log_info "=== ECS Fargate 負荷試験開始 ==="
    log_info "リージョン: $REGION"
    log_info "シミュレーションモード: $SIMULATION_MODE"
    
    # コスト見積もり
    calculate_fargate_cost "$TASK_COUNT" "$CPU_UNITS" "$MEMORY_MB"
    
    # Fargateタスク実行
    run_fargate_tasks
    
    # レポート生成
    generate_fargate_report
    
    log_info "=== ECS Fargate 負荷試験完了 ==="
    log_info "レポート: $OUTPUT_DIR"
}

# メイン実行
main "$@"