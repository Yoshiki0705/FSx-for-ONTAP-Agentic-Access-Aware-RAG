#!/bin/bash
# CloudFormationスタック監視ツール

set -euo pipefail

# スクリプトディレクトリの取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 設定
LOG_FILE="${PROJECT_ROOT}/monitoring.log"
ALERT_EMAIL=""
SNS_TOPIC_ARN=""

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ログ関数
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${CYAN}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

# 使用方法表示
show_usage() {
    cat << EOF
CloudFormationスタック監視ツール

使用方法: $0 [OPTIONS]

OPTIONS:
    -s, --stack <name>         監視するスタック名
    -a, --all                  全スタックを監視
    -w, --watch                リアルタイム監視モード
    -i, --interval <seconds>   監視間隔（デフォルト: 30秒）
    -d, --drift                ドリフト検出を実行
    -e, --events               最新イベントを表示
    -r, --resources            リソース状態を表示
    -o, --outputs              出力値を表示
    -c, --costs                コスト情報を表示
    -n, --notify <email>       アラート通知先メールアドレス
    -t, --topic <arn>          SNSトピックARN
    -v, --verbose              詳細出力
    -h, --help                 このヘルプを表示

例:
    $0 --stack embedding-batch-dev --watch
    $0 --all --drift
    $0 --stack my-stack --events --resources
    $0 --stack my-stack --notify admin@company.com
EOF
}

# 前提条件チェック
check_prerequisites() {
    log "前提条件をチェック中..."
    
    # AWS CLI
    if ! command -v aws &> /dev/null; then
        error "AWS CLIがインストールされていません"
        return 1
    fi
    
    # jq
    if ! command -v jq &> /dev/null; then
        error "jqがインストールされていません"
        return 1
    fi
    
    # AWS認証確認
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS認証が設定されていません"
        return 1
    fi
    
    success "前提条件チェック完了"
}

# スタック状態取得
get_stack_status() {
    local stack_name="$1"
    
    aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query 'Stacks[0].StackStatus' \
        --output text 2>/dev/null || echo "NOT_FOUND"
}

# スタック詳細情報取得
get_stack_details() {
    local stack_name="$1"
    
    log "スタック詳細情報: $stack_name"
    
    local stack_info
    stack_info=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --output json 2>/dev/null || echo "{}")
    
    if [[ "$stack_info" == "{}" ]]; then
        error "スタックが見つかりません: $stack_name"
        return 1
    fi
    
    # 基本情報
    echo -e "${PURPLE}=== スタック基本情報 ===${NC}"
    echo "$stack_info" | jq -r '
        .Stacks[0] | 
        "スタック名: " + .StackName + "\n" +
        "状態: " + .StackStatus + "\n" +
        "作成日時: " + .CreationTime + "\n" +
        "更新日時: " + (.LastUpdatedTime // "未更新") + "\n" +
        "説明: " + (.Description // "なし")
    '
    
    # タグ情報
    echo -e "\n${PURPLE}=== タグ情報 ===${NC}"
    echo "$stack_info" | jq -r '.Stacks[0].Tags[]? | "  " + .Key + ": " + .Value'
    
    # パラメータ情報
    echo -e "\n${PURPLE}=== パラメータ ===${NC}"
    echo "$stack_info" | jq -r '.Stacks[0].Parameters[]? | "  " + .ParameterKey + ": " + .ParameterValue'
    
    return 0
}

# スタックイベント表示
show_stack_events() {
    local stack_name="$1"
    local limit="${2:-10}"
    
    log "最新イベント表示: $stack_name (最新${limit}件)"
    
    echo -e "${PURPLE}=== 最新イベント ===${NC}"
    aws cloudformation describe-stack-events \
        --stack-name "$stack_name" \
        --max-items "$limit" \
        --query 'StackEvents[].[Timestamp,LogicalResourceId,ResourceStatus,ResourceStatusReason]' \
        --output table 2>/dev/null || {
        error "イベント取得に失敗しました: $stack_name"
        return 1
    }
}

# リソース状態表示
show_stack_resources() {
    local stack_name="$1"
    
    log "リソース状態表示: $stack_name"
    
    echo -e "${PURPLE}=== リソース状態 ===${NC}"
    aws cloudformation describe-stack-resources \
        --stack-name "$stack_name" \
        --query 'StackResources[].[LogicalResourceId,ResourceType,ResourceStatus,PhysicalResourceId]' \
        --output table 2>/dev/null || {
        error "リソース情報取得に失敗しました: $stack_name"
        return 1
    }
    
    # 失敗したリソースがあるかチェック
    local failed_resources
    failed_resources=$(aws cloudformation describe-stack-resources \
        --stack-name "$stack_name" \
        --query 'StackResources[?contains(ResourceStatus, `FAILED`)].LogicalResourceId' \
        --output text 2>/dev/null || echo "")
    
    if [[ -n "$failed_resources" ]]; then
        warning "失敗したリソースが見つかりました: $failed_resources"
    fi
}

# 出力値表示
show_stack_outputs() {
    local stack_name="$1"
    
    log "出力値表示: $stack_name"
    
    echo -e "${PURPLE}=== 出力値 ===${NC}"
    aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query 'Stacks[0].Outputs[].[OutputKey,OutputValue,Description]' \
        --output table 2>/dev/null || {
        warning "出力値が設定されていません: $stack_name"
    }
}

# ドリフト検出
detect_drift() {
    local stack_name="$1"
    
    log "ドリフト検出開始: $stack_name"
    
    # ドリフト検出開始
    local drift_id
    drift_id=$(aws cloudformation detect-stack-drift \
        --stack-name "$stack_name" \
        --query 'StackDriftDetectionId' \
        --output text 2>/dev/null || echo "")
    
    if [[ -z "$drift_id" ]]; then
        error "ドリフト検出の開始に失敗しました: $stack_name"
        return 1
    fi
    
    info "ドリフト検出ID: $drift_id"
    
    # 検出完了まで待機
    local status=""
    local attempts=0
    while [[ $attempts -lt 60 ]]; do
        status=$(aws cloudformation describe-stack-drift-detection-status \
            --stack-drift-detection-id "$drift_id" \
            --query 'DetectionStatus' \
            --output text 2>/dev/null || echo "FAILED")
        
        case "$status" in
            "DETECTION_COMPLETE")
                success "ドリフト検出完了"
                break
                ;;
            "DETECTION_FAILED")
                error "ドリフト検出に失敗しました"
                return 1
                ;;
            "DETECTION_IN_PROGRESS")
                info "ドリフト検出中... ($((attempts * 5))秒経過)"
                ;;
        esac
        
        sleep 5
        ((attempts++))
    done
    
    if [[ "$status" != "DETECTION_COMPLETE" ]]; then
        error "ドリフト検出がタイムアウトしました"
        return 1
    fi
    
    # ドリフト結果確認
    local drift_status
    drift_status=$(aws cloudformation describe-stack-drift-detection-status \
        --stack-drift-detection-id "$drift_id" \
        --query 'StackDriftStatus' \
        --output text 2>/dev/null || echo "UNKNOWN")
    
    echo -e "\n${PURPLE}=== ドリフト検出結果 ===${NC}"
    case "$drift_status" in
        "DRIFTED")
            warning "ドリフトが検出されました: $stack_name"
            
            # ドリフト詳細表示
            aws cloudformation describe-stack-resource-drifts \
                --stack-name "$stack_name" \
                --query 'StackResourceDrifts[?StackResourceDriftStatus==`MODIFIED`].[LogicalResourceId,ResourceType,StackResourceDriftStatus]' \
                --output table 2>/dev/null || true
            
            # アラート送信
            if [[ -n "$ALERT_EMAIL" || -n "$SNS_TOPIC_ARN" ]]; then
                send_alert "CloudFormation Drift Detected" \
                    "スタック $stack_name でドリフトが検出されました。確認してください。"
            fi
            ;;
        "IN_SYNC")
            success "ドリフトは検出されませんでした: $stack_name"
            ;;
        *)
            warning "ドリフト状態が不明です: $drift_status"
            ;;
    esac
    
    return 0
}

# コスト情報表示
show_cost_information() {
    local stack_name="$1"
    
    log "コスト情報表示: $stack_name"
    
    echo -e "${PURPLE}=== コスト情報 ===${NC}"
    
    # Cost Explorerが利用可能かチェック
    if aws ce get-cost-and-usage \
        --time-period Start=2024-01-01,End=2024-01-02 \
        --granularity DAILY \
        --metrics BlendedCost \
        &> /dev/null; then
        
        # 過去30日のコスト取得
        local start_date end_date
        start_date=$(date -d '30 days ago' '+%Y-%m-%d')
        end_date=$(date '+%Y-%m-%d')
        
        aws ce get-cost-and-usage \
            --time-period "Start=$start_date,End=$end_date" \
            --granularity MONTHLY \
            --metrics BlendedCost \
            --group-by Type=DIMENSION,Key=SERVICE \
            --filter '{\"Dimensions\":{\"Key\":\"RESOURCE_ID\",\"Values\":[\"'$stack_name'\"]}}' \
            --query 'ResultsByTime[0].Groups[].[Keys[0],Metrics.BlendedCost.Amount]' \
            --output table 2>/dev/null || {
            warning "コスト情報の取得に失敗しました"
        }
    else
        warning "Cost Explorerが利用できません"
    fi
    
    # リソース数とタイプの表示
    echo -e "\n${PURPLE}=== リソース概要 ===${NC}"
    aws cloudformation describe-stack-resources \
        --stack-name "$stack_name" \
        --query 'StackResources | group_by(@, &ResourceType) | [].{ResourceType: [0].ResourceType, Count: length(@)}' \
        --output table 2>/dev/null || true
}

# アラート送信
send_alert() {
    local subject="$1"
    local message="$2"
    
    log "アラート送信: $subject"
    
    # SNS通知
    if [[ -n "$SNS_TOPIC_ARN" ]]; then
        if aws sns publish \
            --topic-arn "$SNS_TOPIC_ARN" \
            --message "$message" \
            --subject "$subject" \
            &> /dev/null; then
            success "SNS通知送信完了"
        else
            error "SNS通知送信に失敗しました"
        fi
    fi
    
    # メール通知（SESを使用）
    if [[ -n "$ALERT_EMAIL" ]]; then
        local email_body
        email_body=$(cat << EOF
{
    "Source": "noreply@company.com",
    "Destination": {
        "ToAddresses": ["$ALERT_EMAIL"]
    },
    "Message": {
        "Subject": {
            "Data": "$subject"
        },
        "Body": {
            "Text": {
                "Data": "$message"
            }
        }
    }
}
EOF
        )
        
        if aws ses send-email --cli-input-json "$email_body" &> /dev/null; then
            success "メール通知送信完了"
        else
            warning "メール通知送信に失敗しました（SES設定を確認してください）"
        fi
    fi
}

# リアルタイム監視
watch_stack() {
    local stack_name="$1"
    local interval="$2"
    
    log "リアルタイム監視開始: $stack_name (間隔: ${interval}秒)"
    
    local last_status=""
    local last_event_time=""
    
    while true; do
        clear
        echo -e "${CYAN}=== CloudFormation スタック監視 ===${NC}"
        echo -e "スタック: ${YELLOW}$stack_name${NC}"
        echo -e "監視間隔: ${YELLOW}${interval}秒${NC}"
        echo -e "最終更新: ${YELLOW}$(date)${NC}"
        echo ""
        
        # 現在の状態取得
        local current_status
        current_status=$(get_stack_status "$stack_name")
        
        if [[ "$current_status" == "NOT_FOUND" ]]; then
            error "スタックが見つかりません: $stack_name"
            break
        fi
        
        # 状態変化チェック
        if [[ "$current_status" != "$last_status" ]]; then
            if [[ -n "$last_status" ]]; then
                log "状態変化検出: $last_status → $current_status"
                
                # アラート送信
                if [[ -n "$ALERT_EMAIL" || -n "$SNS_TOPIC_ARN" ]]; then
                    send_alert "CloudFormation Status Change" \
                        "スタック $stack_name の状態が $last_status から $current_status に変更されました。"
                fi
            fi
            last_status="$current_status"
        fi
        
        # 状態表示
        echo -e "${PURPLE}=== 現在の状態 ===${NC}"
        case "$current_status" in
            *"COMPLETE"*)
                echo -e "状態: ${GREEN}$current_status${NC}"
                ;;
            *"PROGRESS"*)
                echo -e "状態: ${YELLOW}$current_status${NC}"
                ;;
            *"FAILED"*)
                echo -e "状態: ${RED}$current_status${NC}"
                ;;
            *)
                echo -e "状態: $current_status"
                ;;
        esac
        
        # 最新イベント表示
        echo -e "\n${PURPLE}=== 最新イベント (5件) ===${NC}"
        aws cloudformation describe-stack-events \
            --stack-name "$stack_name" \
            --max-items 5 \
            --query 'StackEvents[].[Timestamp,LogicalResourceId,ResourceStatus]' \
            --output table 2>/dev/null || echo "イベント取得エラー"
        
        # 進行中の操作がある場合は詳細表示
        if [[ "$current_status" == *"PROGRESS"* ]]; then
            echo -e "\n${PURPLE}=== 進行中のリソース ===${NC}"
            aws cloudformation describe-stack-resources \
                --stack-name "$stack_name" \
                --query 'StackResources[?contains(ResourceStatus, `PROGRESS`)].[LogicalResourceId,ResourceType,ResourceStatus]' \
                --output table 2>/dev/null || echo "進行中リソースなし"
        fi
        
        echo ""
        echo -e "${CYAN}次の更新まで ${interval}秒... (Ctrl+C で終了)${NC}"
        
        sleep "$interval"
    done
}

# 全スタック監視
monitor_all_stacks() {
    log "全スタック監視開始"
    
    echo -e "${PURPLE}=== 全スタック状態 ===${NC}"
    
    # 全スタック一覧取得
    local stacks
    stacks=$(aws cloudformation list-stacks \
        --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE UPDATE_ROLLBACK_COMPLETE \
        --query 'StackSummaries[].[StackName,StackStatus,CreationTime]' \
        --output text 2>/dev/null || echo "")
    
    if [[ -z "$stacks" ]]; then
        warning "アクティブなスタックが見つかりません"
        return 0
    fi
    
    # スタック状態表示
    echo "$stacks" | while IFS=$'\t' read -r stack_name stack_status creation_time; do
        case "$stack_status" in
            *"COMPLETE"*)
                echo -e "${GREEN}✓${NC} $stack_name ($stack_status)"
                ;;
            *"PROGRESS"*)
                echo -e "${YELLOW}⚠${NC} $stack_name ($stack_status)"
                ;;
            *"FAILED"*)
                echo -e "${RED}✗${NC} $stack_name ($stack_status)"
                ;;
            *)
                echo -e "  $stack_name ($stack_status)"
                ;;
        esac
    done
    
    # 問題のあるスタックの詳細表示
    echo -e "\n${PURPLE}=== 問題のあるスタック ===${NC}"
    local problem_stacks
    problem_stacks=$(aws cloudformation list-stacks \
        --stack-status-filter CREATE_FAILED UPDATE_FAILED DELETE_FAILED ROLLBACK_FAILED \
        --query 'StackSummaries[].[StackName,StackStatus]' \
        --output text 2>/dev/null || echo "")
    
    if [[ -n "$problem_stacks" ]]; then
        echo "$problem_stacks" | while IFS=$'\t' read -r stack_name stack_status; do
            echo -e "${RED}✗${NC} $stack_name ($stack_status)"
        done
    else
        echo -e "${GREEN}問題のあるスタックはありません${NC}"
    fi
}

# メイン処理
main() {
    local stack_name=""
    local monitor_all=false
    local watch_mode=false
    local interval=30
    local show_drift=false
    local show_events=false
    local show_resources=false
    local show_outputs=false
    local show_costs=false
    local verbose=false
    
    # パラメータ解析
    while [[ $# -gt 0 ]]; do
        case $1 in
            -s|--stack)
                stack_name="$2"
                shift 2
                ;;
            -a|--all)
                monitor_all=true
                shift
                ;;
            -w|--watch)
                watch_mode=true
                shift
                ;;
            -i|--interval)
                interval="$2"
                shift 2
                ;;
            -d|--drift)
                show_drift=true
                shift
                ;;
            -e|--events)
                show_events=true
                shift
                ;;
            -r|--resources)
                show_resources=true
                shift
                ;;
            -o|--outputs)
                show_outputs=true
                shift
                ;;
            -c|--costs)
                show_costs=true
                shift
                ;;
            -n|--notify)
                ALERT_EMAIL="$2"
                shift 2
                ;;
            -t|--topic)
                SNS_TOPIC_ARN="$2"
                shift 2
                ;;
            -v|--verbose)
                verbose=true
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
    
    # ログファイル初期化
    > "$LOG_FILE"
    
    log "CloudFormationスタック監視開始"
    
    # 前提条件チェック
    if ! check_prerequisites; then
        exit 1
    fi
    
    # 監視実行
    if [[ "$monitor_all" == "true" ]]; then
        monitor_all_stacks
    elif [[ -n "$stack_name" ]]; then
        if [[ "$watch_mode" == "true" ]]; then
            watch_stack "$stack_name" "$interval"
        else
            # 単発監視
            get_stack_details "$stack_name"
            
            if [[ "$show_events" == "true" ]]; then
                echo ""
                show_stack_events "$stack_name"
            fi
            
            if [[ "$show_resources" == "true" ]]; then
                echo ""
                show_stack_resources "$stack_name"
            fi
            
            if [[ "$show_outputs" == "true" ]]; then
                echo ""
                show_stack_outputs "$stack_name"
            fi
            
            if [[ "$show_drift" == "true" ]]; then
                echo ""
                detect_drift "$stack_name"
            fi
            
            if [[ "$show_costs" == "true" ]]; then
                echo ""
                show_cost_information "$stack_name"
            fi
        fi
    else
        error "スタック名または--allオプションを指定してください"
        show_usage
        exit 1
    fi
    
    log "監視完了"
}

# スクリプト実行
main "$@"