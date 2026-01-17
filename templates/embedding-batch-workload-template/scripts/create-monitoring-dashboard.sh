#!/bin/bash
# CloudWatch Monitoring Dashboard 作成スクリプト

set -euo pipefail

# スクリプトディレクトリの取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 設定ファイルの読み込み
if [[ -f "$PROJECT_ROOT/deployment-config.json" ]]; then
    CONFIG_FILE="$PROJECT_ROOT/deployment-config.json"
else
    CONFIG_FILE="$PROJECT_ROOT/examples/basic-config.json"
fi

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
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

# 使用方法表示
show_usage() {
    cat << EOF
CloudWatch Monitoring Dashboard 作成スクリプト

使用方法: $0 [OPTIONS]

OPTIONS:
    -c, --config <file>           設定ファイルのパス
    -m, --method <method>         デプロイ方法 (cdk|cloudformation)
    -e, --email <email>           アラート用メールアドレス
    -s, --sms <number>            アラート用SMS番号
    --enable-cost                 コスト監視を有効化
    --enable-security             セキュリティ監視を有効化
    --dry-run                     実際の作成を行わずに設定を確認
    -h, --help                    このヘルプを表示

例:
    $0 --method cdk --email admin@example.com --enable-cost
    $0 --method cloudformation --config prod-config.json --enable-security
    $0 --dry-run
EOF
}

# 設定値の読み込み
load_config() {
    local config_file="$1"
    
    if [[ ! -f "$config_file" ]]; then
        error "設定ファイルが見つかりません: $config_file"
        exit 1
    fi
    
    log "設定ファイルを読み込み中: $config_file"
    
    # jqを使用してJSONから値を抽出
    PROJECT_NAME=$(jq -r '.projectName // "embedding-batch-workload"' "$config_file")
    ENVIRONMENT=$(jq -r '.environment // "production"' "$config_file")
    REGION=$(jq -r '.region // "us-east-1"' "$config_file")
    VPC_ID=$(jq -r '.vpcId // ""' "$config_file")
    FSX_FILE_SYSTEM_ID=$(jq -r '.fsxFileSystemId // ""' "$config_file")
    
    # リソース名の生成
    JOB_QUEUE_NAME="${PROJECT_NAME}-${ENVIRONMENT}-job-queue"
    COMPUTE_ENV_NAME="${PROJECT_NAME}-${ENVIRONMENT}-compute-env"
    S3_BUCKET_NAME="${PROJECT_NAME}-${ENVIRONMENT}-data"
    DYNAMODB_TABLE_NAME="${PROJECT_NAME}-${ENVIRONMENT}-metadata"
    
    info "プロジェクト: $PROJECT_NAME"
    info "環境: $ENVIRONMENT"
    info "リージョン: $REGION"
}

# 前提条件チェック
check_prerequisites() {
    log "前提条件をチェック中..."
    
    # 必要なツールの確認
    local tools=("aws" "jq")
    
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            error "$tool がインストールされていません"
            exit 1
        fi
    done
    
    # AWS認証情報の確認
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS認証情報が設定されていません"
        exit 1
    fi
    
    # リージョンの設定
    export AWS_DEFAULT_REGION="$REGION"
    
    success "前提条件チェック完了"
}

# CDKによるダッシュボード作成
create_dashboard_cdk() {
    log "CDKを使用してダッシュボードを作成中..."
    
    # CDKディレクトリに移動
    cd "$PROJECT_ROOT/cdk"
    
    # 依存関係のインストール
    if [[ ! -d "node_modules" ]]; then
        log "依存関係をインストール中..."
        npm install
    fi
    
    # TypeScriptのビルド
    log "TypeScriptをビルド中..."
    npm run build
    
    # CDKアプリケーションファイルの更新
    create_cdk_app_file
    
    # CDKデプロイ
    log "CDKスタックをデプロイ中..."
    npx cdk deploy "${PROJECT_NAME}-${ENVIRONMENT}-monitoring" \
        --require-approval never \
        --context projectName="$PROJECT_NAME" \
        --context environment="$ENVIRONMENT" \
        --context jobQueueName="$JOB_QUEUE_NAME" \
        --context computeEnvironmentName="$COMPUTE_ENV_NAME" \
        --context fsxFileSystemId="$FSX_FILE_SYSTEM_ID" \
        --context s3BucketName="$S3_BUCKET_NAME" \
        --context dynamoDbTableName="$DYNAMODB_TABLE_NAME" \
        --context alertEmail="$ALERT_EMAIL" \
        --context alertSms="$ALERT_SMS" \
        --context enableCostMonitoring="$ENABLE_COST" \
        --context enableSecurityMonitoring="$ENABLE_SECURITY"
    
    success "CDKダッシュボード作成完了"
}

# CDKアプリケーションファイルの作成
create_cdk_app_file() {
    cat > "$PROJECT_ROOT/cdk/bin/monitoring-app.ts" << EOF
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MonitoringDashboard } from '../lib/constructs/monitoring-dashboard';

const app = new cdk.App();

const projectName = app.node.tryGetContext('projectName') || 'embedding-batch-workload';
const environment = app.node.tryGetContext('environment') || 'production';
const region = app.node.tryGetContext('region') || 'us-east-1';

const stack = new cdk.Stack(app, \`\${projectName}-\${environment}-monitoring\`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: region
  }
});

new MonitoringDashboard(stack, 'MonitoringDashboard', {
  projectName: projectName,
  environment: environment,
  jobQueueName: app.node.tryGetContext('jobQueueName'),
  computeEnvironmentName: app.node.tryGetContext('computeEnvironmentName'),
  fsxFileSystemId: app.node.tryGetContext('fsxFileSystemId'),
  s3BucketName: app.node.tryGetContext('s3BucketName'),
  dynamoDbTableName: app.node.tryGetContext('dynamoDbTableName'),
  alertEmail: app.node.tryGetContext('alertEmail'),
  alertSms: app.node.tryGetContext('alertSms'),
  enableCostMonitoring: app.node.tryGetContext('enableCostMonitoring') === 'true',
  enableSecurityMonitoring: app.node.tryGetContext('enableSecurityMonitoring') === 'true'
});
EOF
}

# CloudFormationによるダッシュボード作成
create_dashboard_cloudformation() {
    log "CloudFormationを使用してダッシュボードを作成中..."
    
    local stack_name="${PROJECT_NAME}-${ENVIRONMENT}-monitoring"
    local template_file="$PROJECT_ROOT/cloudformation/monitoring-dashboard.yaml"
    
    # パラメータファイルの作成
    local params_file="/tmp/monitoring-params.json"
    create_cloudformation_params "$params_file"
    
    # CloudFormationスタックの作成/更新
    if aws cloudformation describe-stacks --stack-name "$stack_name" &> /dev/null; then
        log "既存スタックを更新中..."
        aws cloudformation update-stack \
            --stack-name "$stack_name" \
            --template-body "file://$template_file" \
            --parameters "file://$params_file" \
            --capabilities CAPABILITY_IAM
        
        aws cloudformation wait stack-update-complete --stack-name "$stack_name"
    else
        log "新しいスタックを作成中..."
        aws cloudformation create-stack \
            --stack-name "$stack_name" \
            --template-body "file://$template_file" \
            --parameters "file://$params_file" \
            --capabilities CAPABILITY_IAM
        
        aws cloudformation wait stack-create-complete --stack-name "$stack_name"
    fi
    
    # 一時ファイルの削除
    rm -f "$params_file"
    
    success "CloudFormationダッシュボード作成完了"
}

# CloudFormationパラメータファイルの作成
create_cloudformation_params() {
    local params_file="$1"
    
    cat > "$params_file" << EOF
[
  {
    "ParameterKey": "ProjectName",
    "ParameterValue": "$PROJECT_NAME"
  },
  {
    "ParameterKey": "Environment",
    "ParameterValue": "$ENVIRONMENT"
  },
  {
    "ParameterKey": "JobQueueName",
    "ParameterValue": "$JOB_QUEUE_NAME"
  },
  {
    "ParameterKey": "ComputeEnvironmentName",
    "ParameterValue": "$COMPUTE_ENV_NAME"
  },
  {
    "ParameterKey": "FsxFileSystemId",
    "ParameterValue": "$FSX_FILE_SYSTEM_ID"
  },
  {
    "ParameterKey": "S3BucketName",
    "ParameterValue": "$S3_BUCKET_NAME"
  },
  {
    "ParameterKey": "DynamoDbTableName",
    "ParameterValue": "$DYNAMODB_TABLE_NAME"
  },
  {
    "ParameterKey": "AlertEmail",
    "ParameterValue": "$ALERT_EMAIL"
  },
  {
    "ParameterKey": "AlertSms",
    "ParameterValue": "$ALERT_SMS"
  },
  {
    "ParameterKey": "EnableCostMonitoring",
    "ParameterValue": "$ENABLE_COST"
  },
  {
    "ParameterKey": "EnableSecurityMonitoring",
    "ParameterValue": "$ENABLE_SECURITY"
  }
]
EOF
}

# ダッシュボードの検証
validate_dashboard() {
    log "ダッシュボードを検証中..."
    
    local dashboard_name="${PROJECT_NAME}-${ENVIRONMENT}-monitoring"
    
    # ダッシュボードの存在確認
    if aws cloudwatch get-dashboard --dashboard-name "$dashboard_name" &> /dev/null; then
        success "メインダッシュボードが正常に作成されました"
        
        # ダッシュボードURLの表示
        local dashboard_url="https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#dashboards:name=${dashboard_name}"
        info "ダッシュボードURL: $dashboard_url"
    else
        error "ダッシュボードの作成に失敗しました"
        return 1
    fi
    
    # アラームの確認
    local alarm_count
    alarm_count=$(aws cloudwatch describe-alarms \
        --alarm-name-prefix "${PROJECT_NAME}-${ENVIRONMENT}" \
        --query 'length(MetricAlarms)' \
        --output text)
    
    info "作成されたアラーム数: $alarm_count"
    
    # SNSトピックの確認
    local topic_count
    topic_count=$(aws sns list-topics \
        --query "Topics[?contains(TopicArn, '${PROJECT_NAME}-${ENVIRONMENT}')]" \
        --output json | jq length)
    
    info "作成されたSNSトピック数: $topic_count"
}

# メイン処理
main() {
    local config_file="$CONFIG_FILE"
    local method="cdk"
    local dry_run=false
    
    # デフォルト値
    ALERT_EMAIL=""
    ALERT_SMS=""
    ENABLE_COST="false"
    ENABLE_SECURITY="false"
    
    # パラメータ解析
    while [[ $# -gt 0 ]]; do
        case $1 in
            -c|--config)
                config_file="$2"
                shift 2
                ;;
            -m|--method)
                method="$2"
                shift 2
                ;;
            -e|--email)
                ALERT_EMAIL="$2"
                shift 2
                ;;
            -s|--sms)
                ALERT_SMS="$2"
                shift 2
                ;;
            --enable-cost)
                ENABLE_COST="true"
                shift
                ;;
            --enable-security)
                ENABLE_SECURITY="true"
                shift
                ;;
            --dry-run)
                dry_run=true
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
    
    # 設定の読み込み
    load_config "$config_file"
    
    # 前提条件チェック
    check_prerequisites
    
    # 設定の表示
    log "=== ダッシュボード作成設定 ==="
    info "デプロイ方法: $method"
    info "プロジェクト名: $PROJECT_NAME"
    info "環境: $ENVIRONMENT"
    info "リージョン: $REGION"
    info "アラートメール: ${ALERT_EMAIL:-未設定}"
    info "アラートSMS: ${ALERT_SMS:-未設定}"
    info "コスト監視: $ENABLE_COST"
    info "セキュリティ監視: $ENABLE_SECURITY"
    
    if [[ "$dry_run" == "true" ]]; then
        info "ドライランモードのため、実際の作成は行いません"
        exit 0
    fi
    
    # ダッシュボード作成
    case "$method" in
        "cdk")
            create_dashboard_cdk
            ;;
        "cloudformation")
            create_dashboard_cloudformation
            ;;
        *)
            error "サポートされていないデプロイ方法: $method"
            exit 1
            ;;
    esac
    
    # 検証
    validate_dashboard
    
    success "監視ダッシュボードの作成が完了しました"
}

# スクリプト実行
main "$@"