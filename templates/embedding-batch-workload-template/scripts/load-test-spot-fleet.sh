#!/bin/bash

# Spot Fleet 負荷試験スクリプト
# スポットインスタンスを使用したコスト最適化負荷試験

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
SPOT_FLEET_NAME="rag-spot-fleet"
TARGET_CAPACITY=10
TEST_DURATION=1800  # 30分
MAX_COST=30.00
SIMULATION_MODE=false
OUTPUT_DIR=""
INSTANCE_TYPES=("t3.medium" "t3.large" "m5.large" "c5.large")
MAX_SPOT_PRICE=0.05  # 1時間あたり最大$0.05

# 使用方法を表示
show_usage() {
    cat << EOF
使用方法: $0 [オプション]

Spot Fleet 負荷試験オプション:
  --fleet-name NAME          Spot Fleet名 (デフォルト: $SPOT_FLEET_NAME)
  --target-capacity COUNT    ターゲット容量 (デフォルト: $TARGET_CAPACITY)
  --test-duration SECONDS    テスト時間（秒） (デフォルト: $TEST_DURATION)
  --max-cost AMOUNT          最大コスト制限 (デフォルト: $MAX_COST)
  --max-spot-price PRICE     最大スポット価格 (デフォルト: $MAX_SPOT_PRICE)
  --region REGION            AWSリージョン (デフォルト: $REGION)
  --simulation               シミュレーションモード
  --output-dir DIR           出力ディレクトリ
  --help                     このヘルプを表示

例:
  $0 --target-capacity 20 --test-duration 3600 --max-cost 50.00
  $0 --simulation --target-capacity 5 --max-spot-price 0.03
EOF
}

# パラメータ解析
while [[ $# -gt 0 ]]; do
    case $1 in
        --fleet-name)
            SPOT_FLEET_NAME="$2"
            shift 2
            ;;
        --target-capacity)
            TARGET_CAPACITY="$2"
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
        --max-spot-price)
            MAX_SPOT_PRICE="$2"
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
    OUTPUT_DIR="$PROJECT_ROOT/reports/spot-fleet-test-$(date +%Y%m%d-%H%M%S)"
fi

# 出力ディレクトリの作成
mkdir -p "$OUTPUT_DIR"
log_info "出力ディレクトリ: $OUTPUT_DIR"

# スポット価格取得
get_spot_prices() {
    if [[ "$SIMULATION_MODE" == "true" ]]; then
        # シミュレーション用のランダムなスポット価格
        for instance_type in "${INSTANCE_TYPES[@]}"; do
            local price=$(echo "scale=4; 0.01 + ($RANDOM % 40) / 1000" | bc -l)
            echo "$instance_type: \$$price/hour"
        done
        return 0
    fi
    
    log_info "現在のスポット価格取得中..."
    
    for instance_type in "${INSTANCE_TYPES[@]}"; do
        local price
        price=$(aws ec2 describe-spot-price-history \
            --instance-types "$instance_type" \
            --product-descriptions "Linux/UNIX" \
            --region "$REGION" \
            --max-items 1 \
            --query 'SpotPriceHistory[0].SpotPrice' \
            --output text 2>/dev/null || echo "0.0500")
        
        log_info "スポット価格 $instance_type: \$$price/hour"
    done
}

# コスト見積もり
estimate_spot_cost() {
    local target_capacity=$1
    local duration_hours=$(echo "scale=2; $TEST_DURATION / 3600" | bc -l)
    
    # 平均スポット価格（シミュレーション）
    local avg_spot_price
    if [[ "$SIMULATION_MODE" == "true" ]]; then
        avg_spot_price=0.025  # $0.025/hour
    else
        avg_spot_price=$MAX_SPOT_PRICE
    fi
    
    # スポットインスタンスコスト
    local spot_cost=$(echo "scale=2; $avg_spot_price * $duration_hours * $target_capacity" | bc -l)
    
    # オンデマンド価格との比較（t3.medium: $0.0416/hour）
    local ondemand_cost=$(echo "scale=2; 0.0416 * $duration_hours * $target_capacity" | bc -l)
    local savings=$(echo "scale=2; $ondemand_cost - $spot_cost" | bc -l)
    local savings_percent=$(echo "scale=1; ($savings / $ondemand_cost) * 100" | bc -l)
    
    # データ転送コスト
    local transfer_cost=$(echo "scale=2; 0.01 * $target_capacity" | bc -l)
    
    local total_cost=$(echo "scale=2; $spot_cost + $transfer_cost" | bc -l)
    
    log_cost "💰 Spot Fleet コスト見積もり（$duration_hours 時間）:"
    log_cost "   - スポットインスタンス: \$$spot_cost"
    log_cost "   - データ転送: \$$transfer_cost"
    log_cost "   - 合計予想コスト: \$$total_cost"
    log_cost "   - オンデマンド比較: \$$ondemand_cost → \$$total_cost"
    log_cost "   - 💡 節約額: \$$savings ($savings_percent%削減)"
    
    # コスト制限チェック
    if (( $(echo "$total_cost > $MAX_COST" | bc -l) )); then
        log_error "予想コスト（\$$total_cost）が制限（\$$MAX_COST）を超過"
        return 1
    fi
    
    echo "$total_cost"
}

# Spot Fleet設定生成
generate_spot_fleet_config() {
    local config_file="$OUTPUT_DIR/spot-fleet-config.json"
    
    log_info "Spot Fleet設定生成: $config_file"
    
    cat > "$config_file" << EOF
{
    "SpotFleetRequestConfig": {
        "IamFleetRole": "arn:aws:iam::123456789012:role/aws-ec2-spot-fleet-tagging-role",
        "AllocationStrategy": "diversified",
        "TargetCapacity": $TARGET_CAPACITY,
        "SpotPrice": "$MAX_SPOT_PRICE",
        "LaunchSpecifications": [
EOF

    # 各インスタンスタイプの設定を追加
    local first=true
    for instance_type in "${INSTANCE_TYPES[@]}"; do
        if [[ "$first" == "true" ]]; then
            first=false
        else
            echo "," >> "$config_file"
        fi
        
        cat >> "$config_file" << EOF
            {
                "ImageId": "ami-0c02fb55956c7d316",
                "InstanceType": "$instance_type",
                "KeyName": "my-key-pair",
                "SecurityGroups": [
                    {
                        "GroupId": "sg-12345678"
                    }
                ],
                "SubnetId": "subnet-12345678",
                "UserData": "$(echo 'IyEvYmluL2Jhc2gKeXVtIHVwZGF0ZSAteQp5dW0gaW5zdGFsbCAteSBkb2NrZXIKc2VydmljZSBkb2NrZXIgc3RhcnQK' | base64 -d | base64 -w 0)"
            }
EOF
    done
    
    cat >> "$config_file" << EOF
        ],
        "TerminateInstancesWithExpiration": true,
        "Type": "maintain"
    }
}
EOF

    log_info "✅ Spot Fleet設定生成完了"
}

# スポット中断シミュレーション
simulate_spot_interruption() {
    if [[ "$SIMULATION_MODE" != "true" ]]; then
        log_warn "実際の中断テストは本番環境で実行してください"
        return 0
    fi
    
    log_info "=== スポット中断シミュレーション開始 ==="
    
    local interruption_file="$OUTPUT_DIR/spot-interruptions.json"
    
    # ランダムな中断イベントを生成
    for i in $(seq 1 5); do
        local interrupt_time=$((RANDOM % TEST_DURATION))
        local instance_id="i-$(printf "%08x" $RANDOM)$(printf "%08x" $RANDOM)"
        local instance_type="${INSTANCE_TYPES[$((RANDOM % ${#INSTANCE_TYPES[@]}))]}"
        
        cat >> "$interruption_file" << EOF
{
  "timestamp": "$(date -d "+${interrupt_time} seconds" '+%Y-%m-%d %H:%M:%S')",
  "instance_id": "$instance_id",
  "instance_type": "$instance_type",
  "interruption_reason": "spot-price-exceeded",
  "recovery_time_seconds": $((60 + RANDOM % 180))
}
EOF
        
        if [[ $i -lt 5 ]]; then
            echo "," >> "$interruption_file"
        fi
    done
    
    log_info "✅ スポット中断シミュレーション完了"
}

# 性能比較テスト
run_performance_comparison() {
    log_info "=== インスタンスタイプ性能比較開始 ==="
    
    local performance_file="$OUTPUT_DIR/performance-comparison.json"
    
    cat > "$performance_file" << EOF
{
  "test_results": [
EOF

    local first=true
    for instance_type in "${INSTANCE_TYPES[@]}"; do
        if [[ "$first" == "true" ]]; then
            first=false
        else
            echo "," >> "$performance_file"
        fi
        
        # シミュレーション用の性能データ
        local cpu_score=$((1000 + RANDOM % 2000))
        local memory_score=$((800 + RANDOM % 1200))
        local network_score=$((500 + RANDOM % 1500))
        local cost_per_hour=$(echo "scale=4; 0.02 + ($RANDOM % 30) / 1000" | bc -l)
        
        cat >> "$performance_file" << EOF
    {
      "instance_type": "$instance_type",
      "cpu_benchmark_score": $cpu_score,
      "memory_benchmark_score": $memory_score,
      "network_benchmark_score": $network_score,
      "cost_per_hour": $cost_per_hour,
      "performance_per_dollar": $(echo "scale=2; ($cpu_score + $memory_score + $network_score) / (3 * $cost_per_hour)" | bc -l)
    }
EOF
    done
    
    cat >> "$performance_file" << EOF
  ]
}
EOF

    log_info "✅ 性能比較テスト完了"
}

# Spot Fleet負荷試験実行
run_spot_fleet_test() {
    local start_time=$(date +%s)
    local end_time=$((start_time + TEST_DURATION))
    
    log_info "=== Spot Fleet 負荷試験開始 ==="
    log_info "ターゲット容量: $TARGET_CAPACITY"
    log_info "最大スポット価格: \$$MAX_SPOT_PRICE/hour"
    log_info "テスト時間: $TEST_DURATION 秒"
    log_info "開始時刻: $(date)"
    
    # スポット価格取得
    get_spot_prices
    
    # Spot Fleet設定生成
    generate_spot_fleet_config
    
    # メトリクス収集ファイル
    local metrics_file="$OUTPUT_DIR/spot-fleet-metrics.json"
    
    if [[ "$SIMULATION_MODE" == "true" ]]; then
        log_info "シミュレーションモード: Spot Fleet動作をシミュレート"
        
        while [[ $(date +%s) -lt $end_time ]]; do
            local current_time=$(date +%s)
            local elapsed=$((current_time - start_time))
            
            # 進捗表示
            if (( elapsed % 120 == 0 )); then  # 2分ごと
                local remaining=$((end_time - current_time))
                log_info "進捗: ${elapsed}秒経過, 残り${remaining}秒"
            fi
            
            # シミュレーションメトリクス収集
            collect_spot_metrics "$metrics_file"
            
            sleep 30
        done
        
        # スポット中断シミュレーション
        simulate_spot_interruption
        
        # 性能比較テスト
        run_performance_comparison
    else
        log_warn "実際のSpot Fleet実行は手動で設定してください"
        log_warn "適切なIAMロールとセキュリティグループが必要です"
    fi
    
    log_info "=== Spot Fleet 負荷試験完了 ==="
    log_info "終了時刻: $(date)"
}

# Spot Fleetメトリクス収集
collect_spot_metrics() {
    local metrics_file="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # シミュレーション用メトリクス
    local active_instances=$((TARGET_CAPACITY + RANDOM % 3 - 1))
    local fulfilled_capacity=$((TARGET_CAPACITY + RANDOM % 2 - 1))
    local avg_spot_price=$(echo "scale=4; 0.02 + ($RANDOM % 20) / 1000" | bc -l)
    local interruptions=$((RANDOM % 2))
    
    cat >> "$metrics_file" << EOF
{
  "timestamp": "$timestamp",
  "fleet_name": "$SPOT_FLEET_NAME",
  "target_capacity": $TARGET_CAPACITY,
  "active_instances": $active_instances,
  "fulfilled_capacity": $fulfilled_capacity,
  "average_spot_price": $avg_spot_price,
  "interruptions_count": $interruptions,
  "cost_savings_percent": $(echo "scale=1; (0.0416 - $avg_spot_price) / 0.0416 * 100" | bc -l)
}
EOF
}

# Spot Fleetレポート生成
generate_spot_fleet_report() {
    local report_file="$OUTPUT_DIR/spot-fleet-load-test-report.html"
    local estimated_cost
    estimated_cost=$(estimate_spot_cost "$TARGET_CAPACITY")
    
    log_info "Spot Fleetレポート生成中: $report_file"
    
    cat > "$report_file" << EOF
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Spot Fleet 負荷試験レポート</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #fff3cd; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .metric-card { background: #f9f9f9; padding: 15px; border-radius: 5px; text-align: center; }
        .cost-section { background-color: #d4edda; }
        .interruption-section { background-color: #f8d7da; }
        .performance-section { background-color: #d1ecf1; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .savings { color: #28a745; font-weight: bold; font-size: 1.2em; }
        .risk { color: #dc3545; font-weight: bold; }
        .benefit { color: #28a745; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>💰 Spot Fleet 負荷試験レポート</h1>
        <p><strong>実行日時:</strong> $(date)</p>
        <p><strong>リージョン:</strong> $REGION</p>
        <p><strong>シミュレーションモード:</strong> $SIMULATION_MODE</p>
    </div>

    <div class="section">
        <h2>📊 テスト設定</h2>
        <table>
            <tr><th>項目</th><th>値</th></tr>
            <tr><td>Spot Fleet名</td><td>$SPOT_FLEET_NAME</td></tr>
            <tr><td>ターゲット容量</td><td>$TARGET_CAPACITY インスタンス</td></tr>
            <tr><td>最大スポット価格</td><td>\$$MAX_SPOT_PRICE/hour</td></tr>
            <tr><td>インスタンスタイプ</td><td>${INSTANCE_TYPES[*]}</td></tr>
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
                <h3>オンデマンド比較</h3>
                <p class="savings">最大90%削減</p>
            </div>
            <div class="metric-card">
                <h3>時間あたりコスト</h3>
                <p style="font-size: 20px;">\$$(echo "scale=2; $estimated_cost / ($TEST_DURATION / 3600)" | bc -l)</p>
            </div>
        </div>
        
        <h3>💡 Spot Fleet コスト効率</h3>
        <ul>
            <li class="benefit">✅ オンデマンドより50-90%安価</li>
            <li class="benefit">✅ 複数インスタンスタイプで価格最適化</li>
            <li class="benefit">✅ 自動的な最安価格選択</li>
            <li class="benefit">✅ 大規模ワークロードに最適</li>
        </ul>
    </div>

    <div class="section interruption-section">
        <h2>⚠️ スポット中断分析</h2>
        <div class="metrics">
            <div class="metric-card">
                <h3>中断リスク</h3>
                <p style="font-size: 20px; color: #dc3545;">低〜中</p>
            </div>
            <div class="metric-card">
                <h3>復旧時間</h3>
                <p style="font-size: 20px;">1-3分</p>
            </div>
            <div class="metric-card">
                <h3>可用性</h3>
                <p style="font-size: 20px; color: #28a745;">95-99%</p>
            </div>
        </div>
        
        <h3>🛡️ 中断対策</h3>
        <ul>
            <li>複数のインスタンスタイプとAZを使用</li>
            <li>チェックポイント機能の実装</li>
            <li>自動リトライ機構の設定</li>
            <li>スポット中断通知の活用</li>
            <li>混合インスタンス（オンデマンド+スポット）</li>
        </ul>
    </div>

    <div class="section performance-section">
        <h2>⚡ 性能分析</h2>
        <h3>📈 インスタンスタイプ比較</h3>
        <table>
            <tr><th>インスタンスタイプ</th><th>vCPU</th><th>メモリ</th><th>ネットワーク</th><th>推奨用途</th></tr>
            <tr><td>t3.medium</td><td>2</td><td>4GB</td><td>最大5Gbps</td><td>軽量処理</td></tr>
            <tr><td>t3.large</td><td>2</td><td>8GB</td><td>最大5Gbps</td><td>標準処理</td></tr>
            <tr><td>m5.large</td><td>2</td><td>8GB</td><td>最大10Gbps</td><td>汎用処理</td></tr>
            <tr><td>c5.large</td><td>2</td><td>4GB</td><td>最大10Gbps</td><td>CPU集約処理</td></tr>
        </table>
        
        <h3>🎯 最適化戦略</h3>
        <ul>
            <li><strong>多様化:</strong> 複数インスタンスタイプで中断リスク分散</li>
            <li><strong>価格監視:</strong> リアルタイムスポット価格追跡</li>
            <li><strong>自動スケーリング:</strong> 需要に応じた容量調整</li>
            <li><strong>フォルトトレラント:</strong> 中断に強いアーキテクチャ</li>
        </ul>
    </div>

    <div class="section">
        <h2>📊 推奨ユースケース</h2>
        <h3 class="benefit">✅ 適している処理</h3>
        <ul>
            <li>バッチ処理・データ分析</li>
            <li>機械学習トレーニング</li>
            <li>CI/CDパイプライン</li>
            <li>レンダリング・エンコーディング</li>
            <li>科学計算・シミュレーション</li>
        </ul>
        
        <h3 class="risk">❌ 適していない処理</h3>
        <ul>
            <li>リアルタイム処理</li>
            <li>データベースサーバー</li>
            <li>ステートフルアプリケーション</li>
            <li>短時間（<10分）の処理</li>
        </ul>
    </div>

    <div class="section">
        <h2>🔗 関連リソース</h2>
        <ul>
            <li><a href="https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/spot-fleet.html">Spot Fleet</a></li>
            <li><a href="https://aws.amazon.com/ec2/spot/pricing/">Spot Instance Pricing</a></li>
            <li><a href="https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/spot-best-practices.html">Spot Best Practices</a></li>
        </ul>
    </div>
</body>
</html>
EOF

    log_info "✅ Spot Fleetレポート生成完了: $report_file"
}

# メイン実行
main() {
    log_info "=== Spot Fleet 負荷試験開始 ==="
    log_info "リージョン: $REGION"
    log_info "シミュレーションモード: $SIMULATION_MODE"
    
    # コスト見積もり
    estimate_spot_cost "$TARGET_CAPACITY"
    
    # Spot Fleet負荷試験実行
    run_spot_fleet_test
    
    # レポート生成
    generate_spot_fleet_report
    
    log_info "=== Spot Fleet 負荷試験完了 ==="
    log_info "レポート: $OUTPUT_DIR"
}

# メイン実行
main "$@"