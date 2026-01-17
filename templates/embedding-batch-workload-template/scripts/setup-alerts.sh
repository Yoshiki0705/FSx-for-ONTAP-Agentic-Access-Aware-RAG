#!/bin/bash

# Alert Management Setup Script
# アラート管理システムの設定とデプロイメント

set -euo pipefail

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 設定ファイルの読み込み
source "$SCRIPT_DIR/lib/config-utils.sh"

# ログ設定
LOG_FILE="$PROJECT_ROOT/logs/alert-setup-$(date +%Y%m%d-%H%M%S).log"
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

アラート管理システムの設定とデプロイメント

オプション:
    -e, --environment ENV    環境名 (dev, staging, prod)
    -c, --config FILE        設定ファイルパス
    -t, --test              テストモードで実行
    -v, --validate          設定の検証のみ実行
    -d, --deploy            アラートシステムをデプロイ
    -s, --setup-contacts    連絡先の設定
    -i, --setup-integrations 外部統合の設定
    -h, --help              このヘルプを表示

例:
    $0 --environment prod --deploy
    $0 --config custom-alert-config.json --validate
    $0 --setup-contacts --environment dev

EOF
}

# デフォルト値
ENVIRONMENT="dev"
CONFIG_FILE=""
TEST_MODE=false
VALIDATE_ONLY=false
DEPLOY_ALERTS=false
SETUP_CONTACTS=false
SETUP_INTEGRATIONS=false

# コマンドライン引数の解析
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -c|--config)
            CONFIG_FILE="$2"
            shift 2
            ;;
        -t|--test)
            TEST_MODE=true
            shift
            ;;
        -v|--validate)
            VALIDATE_ONLY=true
            shift
            ;;
        -d|--deploy)
            DEPLOY_ALERTS=true
            shift
            ;;
        -s|--setup-contacts)
            SETUP_CONTACTS=true
            shift
            ;;
        -i|--setup-integrations)
            SETUP_INTEGRATIONS=true
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

# 環境の検証
validate_environment() {
    log "環境の検証: $ENVIRONMENT"
    
    case "$ENVIRONMENT" in
        dev|development)
            ENVIRONMENT="dev"
            ;;
        staging|stage)
            ENVIRONMENT="staging"
            ;;
        prod|production)
            ENVIRONMENT="prod"
            ;;
        *)
            error "無効な環境名: $ENVIRONMENT"
            error "有効な環境名: dev, staging, prod"
            exit 1
            ;;
    esac
    
    log "環境設定完了: $ENVIRONMENT"
}

# 設定ファイルの決定
determine_config_file() {
    if [[ -n "$CONFIG_FILE" ]]; then
        if [[ ! -f "$CONFIG_FILE" ]]; then
            error "指定された設定ファイルが見つかりません: $CONFIG_FILE"
            exit 1
        fi
        log "カスタム設定ファイルを使用: $CONFIG_FILE"
    else
        # 環境別のデフォルト設定ファイル
        case "$ENVIRONMENT" in
            dev)
                CONFIG_FILE="$PROJECT_ROOT/examples/alert-configurations/development-alert-config.json"
                ;;
            staging)
                CONFIG_FILE="$PROJECT_ROOT/examples/alert-configurations/staging-alert-config.json"
                ;;
            prod)
                CONFIG_FILE="$PROJECT_ROOT/examples/alert-configurations/production-alert-config.json"
                ;;
        esac
        
        if [[ ! -f "$CONFIG_FILE" ]]; then
            log "デフォルト設定ファイルが見つかりません。基本設定を作成します。"
            create_default_config
        fi
        
        log "デフォルト設定ファイルを使用: $CONFIG_FILE"
    fi
}

# デフォルト設定の作成
create_default_config() {
    log "基本的なアラート設定を作成中..."
    
    mkdir -p "$(dirname "$CONFIG_FILE")"
    
    cat > "$CONFIG_FILE" << EOF
{
  "enabled": true,
  "contacts": [
    {
      "name": "Default Operations Team",
      "email": "ops@company.com",
      "severity": ["CRITICAL", "HIGH"],
      "role": "OPERATIONS"
    }
  ],
  "thresholds": {
    "critical": {
      "systemDownMinutes": 5,
      "jobFailureRatePercent": 50,
      "fsxUnavailableMinutes": 3,
      "dataLossRisk": true
    },
    "high": {
      "cpuUtilizationPercent": 85,
      "memoryUtilizationPercent": 80,
      "jobBacklogCount": 100,
      "dynamoThrottleCount": 10,
      "responseTimeSeconds": 30
    },
    "medium": {
      "longRunningJobMinutes": 60,
      "diskUtilizationPercent": 75,
      "networkLatencyMs": 1000,
      "errorRatePercent": 5
    },
    "low": {
      "lowThroughputJobsPerHour": 10,
      "unusedResourcesPercent": 20,
      "costVariancePercent": 15
    }
  },
  "integrations": {
    "email": {
      "enabled": true,
      "sesConfig": {
        "region": "us-east-1",
        "fromAddress": "alerts@company.com"
      },
      "templates": {
        "critical": {
          "subject": "🚨 CRITICAL Alert: {{alarmName}}",
          "htmlBody": "<h1>Critical Alert</h1><p>{{alarmDescription}}</p>",
          "textBody": "Critical Alert: {{alarmName}} - {{alarmDescription}}"
        },
        "high": {
          "subject": "⚠️ HIGH Alert: {{alarmName}}",
          "htmlBody": "<h1>High Priority Alert</h1><p>{{alarmDescription}}</p>",
          "textBody": "High Alert: {{alarmName}} - {{alarmDescription}}"
        },
        "medium": {
          "subject": "📊 MEDIUM Alert: {{alarmName}}",
          "htmlBody": "<h1>Medium Priority Alert</h1><p>{{alarmDescription}}</p>",
          "textBody": "Medium Alert: {{alarmName}} - {{alarmDescription}}"
        },
        "low": {
          "subject": "📝 LOW Alert: {{alarmName}}",
          "htmlBody": "<h1>Low Priority Alert</h1><p>{{alarmDescription}}</p>",
          "textBody": "Low Alert: {{alarmName}} - {{alarmDescription}}"
        }
      }
    },
    "sms": {
      "enabled": false,
      "provider": "sns",
      "config": {
        "region": "us-east-1"
      }
    }
  },
  "escalation": {
    "enabled": false,
    "rules": [],
    "maxEscalationLevel": 1,
    "cooldownMinutes": 60
  },
  "autoRemediation": {
    "enabled": false,
    "rules": [],
    "safetyChecks": [],
    "maxActions": 5,
    "cooldownMinutes": 30
  },
  "notifications": {
    "channels": [
      {
        "name": "email-default",
        "type": "email",
        "config": {},
        "severity": ["CRITICAL", "HIGH", "MEDIUM"],
        "enabled": true
      }
    ],
    "formatting": {
      "includeMetrics": true,
      "includeGraphs": false,
      "includeRunbooks": false,
      "customFields": []
    },
    "filtering": {
      "duplicateSuppressionMinutes": 15,
      "keywordFilters": [],
      "severityFilters": [],
      "timeFilters": []
    },
    "batching": {
      "enabled": false,
      "windowMinutes": 5,
      "maxBatchSize": 10,
      "severityGrouping": true
    }
  }
}
EOF
    
    log "基本設定ファイルを作成しました: $CONFIG_FILE"
}

# 設定の検証
validate_config() {
    log "アラート設定の検証中..."
    
    if [[ ! -f "$CONFIG_FILE" ]]; then
        error "設定ファイルが見つかりません: $CONFIG_FILE"
        exit 1
    fi
    
    # JSON形式の検証
    if ! jq empty "$CONFIG_FILE" 2>/dev/null; then
        error "設定ファイルのJSON形式が無効です: $CONFIG_FILE"
        exit 1
    fi
    
    # 必須フィールドの検証
    local required_fields=(
        ".enabled"
        ".contacts"
        ".thresholds"
        ".integrations"
    )
    
    for field in "${required_fields[@]}"; do
        if ! jq -e "$field" "$CONFIG_FILE" >/dev/null 2>&1; then
            error "必須フィールドが見つかりません: $field"
            exit 1
        fi
    done
    
    # 連絡先の検証
    local contact_count
    contact_count=$(jq '.contacts | length' "$CONFIG_FILE")
    if [[ "$contact_count" -eq 0 ]]; then
        error "最低1つの連絡先が必要です"
        exit 1
    fi
    
    # メールアドレスの検証
    local invalid_emails
    invalid_emails=$(jq -r '.contacts[] | select(.email) | .email' "$CONFIG_FILE" | grep -v '@' || true)
    if [[ -n "$invalid_emails" ]]; then
        error "無効なメールアドレスが含まれています"
        exit 1
    fi
    
    log "設定の検証が完了しました"
}

# 連絡先の設定
setup_contacts() {
    log "連絡先の設定を開始..."
    
    echo "現在の連絡先設定:"
    jq -r '.contacts[] | "- \(.name) (\(.email // "メールなし")) - 役割: \(.role) - 重要度: \(.severity | join(", "))"' "$CONFIG_FILE"
    
    echo ""
    read -p "連絡先を追加しますか？ (y/N): " -r
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        add_contact
    fi
    
    echo ""
    read -p "既存の連絡先を編集しますか？ (y/N): " -r
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        edit_contact
    fi
}

# 連絡先の追加
add_contact() {
    log "新しい連絡先を追加..."
    
    read -p "連絡先名: " contact_name
    read -p "メールアドレス: " contact_email
    read -p "電話番号 (オプション): " contact_sms
    
    echo "役割を選択してください:"
    echo "1) PRIMARY_ONCALL"
    echo "2) SECONDARY_ONCALL"
    echo "3) MANAGER"
    echo "4) ENGINEER"
    echo "5) OPERATIONS"
    echo "6) SECURITY"
    read -p "選択 (1-6): " role_choice
    
    case "$role_choice" in
        1) contact_role="PRIMARY_ONCALL" ;;
        2) contact_role="SECONDARY_ONCALL" ;;
        3) contact_role="MANAGER" ;;
        4) contact_role="ENGINEER" ;;
        5) contact_role="OPERATIONS" ;;
        6) contact_role="SECURITY" ;;
        *) contact_role="OPERATIONS" ;;
    esac
    
    echo "アラート重要度を選択してください (複数選択可):"
    echo "1) CRITICAL"
    echo "2) HIGH"
    echo "3) MEDIUM"
    echo "4) LOW"
    read -p "選択 (例: 1,2): " severity_choices
    
    # 重要度の配列を作成
    severity_array="["
    IFS=',' read -ra SEVERITIES <<< "$severity_choices"
    for i in "${SEVERITIES[@]}"; do
        case "$i" in
            1) severity_array+='"CRITICAL",' ;;
            2) severity_array+='"HIGH",' ;;
            3) severity_array+='"MEDIUM",' ;;
            4) severity_array+='"LOW",' ;;
        esac
    done
    severity_array="${severity_array%,}]"
    
    # 新しい連絡先をJSONに追加
    local new_contact
    new_contact=$(cat << EOF
{
  "name": "$contact_name",
  "email": "$contact_email",
  "role": "$contact_role",
  "severity": $severity_array
}
EOF
)
    
    if [[ -n "$contact_sms" ]]; then
        new_contact=$(echo "$new_contact" | jq ". + {\"sms\": \"$contact_sms\"}")
    fi
    
    # 設定ファイルを更新
    local temp_file
    temp_file=$(mktemp)
    jq ".contacts += [$new_contact]" "$CONFIG_FILE" > "$temp_file"
    mv "$temp_file" "$CONFIG_FILE"
    
    log "連絡先を追加しました: $contact_name"
}

# 連絡先の編集
edit_contact() {
    log "既存の連絡先を編集..."
    
    echo "編集する連絡先を選択してください:"
    jq -r '.contacts | to_entries[] | "\(.key + 1)) \(.value.name) (\(.value.email // "メールなし"))"' "$CONFIG_FILE"
    
    read -p "選択 (番号): " contact_index
    contact_index=$((contact_index - 1))
    
    # 選択された連絡先の情報を表示
    echo "現在の設定:"
    jq -r ".contacts[$contact_index]" "$CONFIG_FILE"
    
    echo ""
    read -p "この連絡先を削除しますか？ (y/N): " -r
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        local temp_file
        temp_file=$(mktemp)
        jq "del(.contacts[$contact_index])" "$CONFIG_FILE" > "$temp_file"
        mv "$temp_file" "$CONFIG_FILE"
        log "連絡先を削除しました"
        return
    fi
    
    # 編集処理（簡略化）
    echo "編集機能は今後実装予定です"
}

# 外部統合の設定
setup_integrations() {
    log "外部統合の設定を開始..."
    
    echo "利用可能な統合:"
    echo "1) Slack"
    echo "2) PagerDuty"
    echo "3) Microsoft Teams"
    echo "4) Webhook"
    
    read -p "設定する統合を選択してください (1-4): " integration_choice
    
    case "$integration_choice" in
        1) setup_slack_integration ;;
        2) setup_pagerduty_integration ;;
        3) setup_teams_integration ;;
        4) setup_webhook_integration ;;
        *) log "無効な選択です" ;;
    esac
}

# Slack統合の設定
setup_slack_integration() {
    log "Slack統合を設定中..."
    
    read -p "Slack Webhook URL: " slack_webhook
    read -p "メンションするユーザー (例: @oncall,@ops-team): " slack_mentions
    
    # Slack設定を更新
    local temp_file
    temp_file=$(mktemp)
    jq ".integrations.slack = {
        \"enabled\": true,
        \"webhookUrl\": \"$slack_webhook\",
        \"channels\": [{
            \"name\": \"#alerts\",
            \"severity\": [\"CRITICAL\", \"HIGH\", \"MEDIUM\"],
            \"webhookUrl\": \"$slack_webhook\"
        }],
        \"mentionUsers\": [\"$slack_mentions\"],
        \"threadReplies\": true
    }" "$CONFIG_FILE" > "$temp_file"
    mv "$temp_file" "$CONFIG_FILE"
    
    log "Slack統合を設定しました"
}

# PagerDuty統合の設定
setup_pagerduty_integration() {
    log "PagerDuty統合を設定中..."
    
    read -p "PagerDuty Integration Key: " pagerduty_key
    read -p "PagerDuty Service Key: " pagerduty_service
    
    # PagerDuty設定を更新
    local temp_file
    temp_file=$(mktemp)
    jq ".integrations.pagerDuty = {
        \"enabled\": true,
        \"integrationKey\": \"$pagerduty_key\",
        \"serviceKey\": \"$pagerduty_service\",
        \"escalationPolicy\": \"default\",
        \"autoResolve\": true
    }" "$CONFIG_FILE" > "$temp_file"
    mv "$temp_file" "$CONFIG_FILE"
    
    log "PagerDuty統合を設定しました"
}

# Teams統合の設定
setup_teams_integration() {
    log "Microsoft Teams統合を設定中..."
    
    read -p "Teams Webhook URL: " teams_webhook
    
    # Teams設定を更新
    local temp_file
    temp_file=$(mktemp)
    jq ".integrations.teams = {
        \"enabled\": true,
        \"webhookUrl\": \"$teams_webhook\",
        \"mentionUsers\": []
    }" "$CONFIG_FILE" > "$temp_file"
    mv "$temp_file" "$CONFIG_FILE"
    
    log "Microsoft Teams統合を設定しました"
}

# Webhook統合の設定
setup_webhook_integration() {
    log "Webhook統合を設定中..."
    
    read -p "Webhook URL: " webhook_url
    read -p "HTTP Method (POST/PUT): " webhook_method
    read -p "API Key (オプション): " webhook_apikey
    
    # Webhook設定を更新
    local webhook_config
    webhook_config=$(cat << EOF
{
  "enabled": true,
  "endpoints": [{
    "url": "$webhook_url",
    "method": "${webhook_method:-POST}",
    "headers": {
      "Content-Type": "application/json"
    },
    "severity": ["CRITICAL", "HIGH"]
  }],
  "retryPolicy": {
    "maxRetries": 3,
    "backoffMultiplier": 2,
    "initialDelaySeconds": 5,
    "maxDelaySeconds": 60
  }
}
EOF
)
    
    if [[ -n "$webhook_apikey" ]]; then
        webhook_config=$(echo "$webhook_config" | jq ".endpoints[0].authentication = {\"type\": \"api-key\", \"apiKey\": \"$webhook_apikey\", \"headerName\": \"X-API-Key\"}")
    fi
    
    local temp_file
    temp_file=$(mktemp)
    jq ".integrations.webhook = $webhook_config" "$CONFIG_FILE" > "$temp_file"
    mv "$temp_file" "$CONFIG_FILE"
    
    log "Webhook統合を設定しました"
}

# アラートシステムのデプロイ
deploy_alerts() {
    log "アラートシステムをデプロイ中..."
    
    # CDKビルド
    log "CDKプロジェクトをビルド中..."
    cd "$PROJECT_ROOT/cdk"
    npm run build
    
    # CDKデプロイ
    log "アラート管理システムをデプロイ中..."
    if [[ "$TEST_MODE" == "true" ]]; then
        log "テストモード: 実際のデプロイは実行されません"
        npx cdk diff --context environment="$ENVIRONMENT"
    else
        npx cdk deploy --context environment="$ENVIRONMENT" --require-approval never
    fi
    
    log "アラートシステムのデプロイが完了しました"
}

# テスト実行
run_tests() {
    log "アラートシステムのテストを実行中..."
    
    # 設定の検証
    validate_config
    
    # アラーム作成のテスト
    log "テストアラームを作成中..."
    
    # CloudWatchアラームの一覧を取得
    aws cloudwatch describe-alarms --alarm-name-prefix "${ENVIRONMENT}-embedding-workload" --query 'MetricAlarms[].AlarmName' --output table
    
    log "テスト完了"
}

# メイン実行
main() {
    log "アラート管理システムセットアップを開始"
    log "環境: $ENVIRONMENT"
    log "テストモード: $TEST_MODE"
    
    # 前提条件の確認
    command -v jq >/dev/null 2>&1 || { error "jqが必要です。インストールしてください。"; exit 1; }
    command -v aws >/dev/null 2>&1 || { error "AWS CLIが必要です。インストールしてください。"; exit 1; }
    
    # 環境の検証
    validate_environment
    
    # 設定ファイルの決定
    determine_config_file
    
    # 設定の検証
    validate_config
    
    # 検証のみの場合は終了
    if [[ "$VALIDATE_ONLY" == "true" ]]; then
        log "設定の検証が完了しました"
        exit 0
    fi
    
    # 連絡先の設定
    if [[ "$SETUP_CONTACTS" == "true" ]]; then
        setup_contacts
    fi
    
    # 外部統合の設定
    if [[ "$SETUP_INTEGRATIONS" == "true" ]]; then
        setup_integrations
    fi
    
    # アラートシステムのデプロイ
    if [[ "$DEPLOY_ALERTS" == "true" ]]; then
        deploy_alerts
    fi
    
    # テスト実行
    if [[ "$TEST_MODE" == "true" ]]; then
        run_tests
    fi
    
    log "アラート管理システムセットアップが完了しました"
    log "ログファイル: $LOG_FILE"
}

# スクリプト実行
main "$@"